from flask import Flask, jsonify, request, send_file, send_from_directory
from Engine import *
from pathlib import Path
import uuid
from flask_sqlalchemy import SQLAlchemy
from flask_login import LoginManager, UserMixin, login_user, login_required, logout_user, current_user
from werkzeug.utils import secure_filename
from werkzeug.security import generate_password_hash, check_password_hash
import threading
import traceback
from dotenv import load_dotenv
import os
from cryptography.fernet import Fernet
import io
import mimetypes
import atexit
import shutil


load_dotenv()

ROOT = Path(__file__).parent
JOBS_DIR = ROOT / "workdir"
JOBS_DIR.mkdir(exist_ok=True)
app = Flask(__name__, static_folder="static", static_url_path="/static")
app.config["MAX_CONTENT_LENGTH"] = 2 * 1024 ** 3
app.config['SECRET_KEY'] = os.getenv('SECRET_KEY')
app.config['SQLALCHEMY_DATABASE_URI'] = os.getenv('SQLALCHEMY_DATABASE_URI')
db = SQLAlchemy(app)
login_manager = LoginManager()
login_manager.init_app(app)
login_manager.login_view = 'auth_page'
JOBS = {}
cleanupdone=False


class User(UserMixin, db.Model):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(150), unique=True, nullable=False)
    password = db.Column(db.String(150), nullable=False)
    private_key = db.Column(db.LargeBinary,nullable=False)
    
@login_manager.user_loader
def load_user(user_id):
    return db.session.get(User, int(user_id))

with app.app_context():
    db.create_all()

def save_upload(field, jobdir):
    f = request.files.get(field)
    if not f or not f.filename:
        return None
    p = jobdir.joinpath(secure_filename(f.filename))
    f.save(p)
    return p

def start_job(jid,jobarg,fn):
    job = JOBS[jid] = {"status": "running", "progress": 0.0, "message": "Queued", "result": None, "error": None}

    def progress(frac, msg=""):
        job["progress"], job["message"] = round(frac, 3), msg
        
    def target():
        try:
            job["result"] = fn(progress,**jobarg)
            job["status"], job["progress"] = "done", 1.0
        except Exception as e:
            traceback.print_exc()
            job["status"], job["error"] = "error", str(e)
    threading.Thread(target=target, daemon=True).start()

def create_uuid():
    jid = uuid.uuid4().hex[:12]
    while jid in JOBS:
        jid = uuid.uuid4().hex[:12]
    return jid

@app.get("/")
def index():
    return send_from_directory("static", "index.html")

@app.get('/auth')
def auth_page():
    return send_from_directory('static', 'auth.html')

@app.get('/dashboard')
@login_required
def dashboard_page():
    return send_from_directory('static', 'dashboard.html')

@app.post("/api/encode")
@login_required
def api_encode():
    jid =  create_uuid()
    jobdir = JOBS_DIR.joinpath(jid)
    jobdir.mkdir()
    src = save_upload("file", jobdir)
    if not src:
        return jsonify(error="No file uploaded"), 400
    song = save_upload("audio", jobdir)
    out = jobdir.joinpath(src.stem+".mkv")
    jobarg = {"private_key":current_user.private_key,"in_path":src,"out_path":out,"audio_path":song,"w":request.form.get("width",1280,type=int),
              "h":request.form.get("height",720,type=int),"fps":request.form.get("fps",30,type=int)}
    start_job(jid,jobarg,encode)
    return jsonify(job=jid)

@app.post("/api/decode")
def api_decode():
    jid = create_uuid()
    jobdir = JOBS_DIR.joinpath(jid)
    jobdir.mkdir()
    src = save_upload("video", jobdir)
    if not src:
        return jsonify(error="No video uploaded"), 400
    jobarg = {"private_key":current_user.private_key,"path":src}
    start_job(jid,jobarg,decode)
    return jsonify(job=jid)

@app.get("/api/jobs/<jid>")
def job_status(jid):
    j = JOBS.get(jid)
    if not j:
        return jsonify(error="unknown job"), 404
    res = dict(j["result"] or {})
    res.pop("file", None)
    return jsonify(status=j["status"], progress=j["progress"], message=j["message"], error=j["error"],
                   result=res, download=f"/api/jobs/{jid}/download" if j["status"] == "done" else None)


@app.get("/api/jobs/<jid>/download")
def job_download(jid):
    j = JOBS.get(jid)
    if not j or j["status"] != "done":
        return jsonify(error="not ready"), 404
    path = j["result"].get("file")
    path_path = Path(path)
    filename = path_path.name
    mimetype,_ = mimetypes.guess_type(filename)
    if mimetype is None:
        mimetype = "application/octet-stream"
    file_bytes = path_path.read_bytes()
    path_folder = path_path.parent
    path_path.unlink()
    path_folder.rmdir()
    JOBS.pop(jid,None)
    buffer = io.BytesIO(file_bytes)
    return send_file(buffer, as_attachment=True,download_name=filename,mimetype=mimetype)

@app.get("/api/info")
def info():
    if current_user.is_authenticated:
        return jsonify({"logged_in": True, "username": current_user.username})
    return jsonify({"logged_in": False})
                                      
@app.post('/api/register')
def api_register():
    data = request.get_json()
    username = data.get('username')
    password = data.get('password')
    private_key = Fernet.generate_key()
    
    if User.query.filter_by(username=username).first():
        return jsonify({"success": False, "message": "Username already exists."}), 400
        
    hashed_password = generate_password_hash(password, method='pbkdf2:sha256')
    new_user = User(username=username, password=hashed_password,private_key=private_key)
    db.session.add(new_user)
    db.session.commit()
    
    login_user(new_user)
    
    return jsonify({"success": True, "message": "Registration and Login successful!"})

@app.post('/api/login')
def api_login():
    data = request.get_json()
    username = data.get('username')
    password = data.get('password')
    
    user = User.query.filter_by(username=username).first()
    if user and check_password_hash(user.password, password):
        login_user(user)
        return jsonify({"success": True, "message": "Login successful!"})
    return jsonify({"success": False, "message": "Invalid username or password."}), 401

@app.post('/api/logout')
@login_required
def api_logout():
    logout_user()
    return jsonify({"success": True, "message": "Logged out successfully."})

def cleanup_on_close():
    global cleanupdone
    if cleanupdone:
        return
    print("Cleaning up all files...")
    for jid,job in JOBS.items():
        folder = Path(job["result"].get("file")).parent
        if folder.exists() and folder.is_dir():
            shutil.rmtree(folder)
    cleanupdone=True

atexit.register(cleanup_on_close)

if __name__ == "__main__":
    try:
        app.run(host="127.0.0.1", port=8000, debug=False, threaded=True)
    finally:
        cleanup_on_close()