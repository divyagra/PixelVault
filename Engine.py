from pathlib import Path
import subprocess
import hashlib
import math
import zlib
from cryptography.fernet import Fernet
from datetime import datetime


MAGIC = b"FLVL"
pix_fmt = "rgba"

def add_audio(vp,ap,op,audio_codec="aac"):
    subprocess.run(["ffmpeg","-y","-loglevel","error","-i",vp,"-stream_loop","-1","-i",ap,
                    "-map","0:v:0","-map","1:a:0","-c:v","copy","-c:a",audio_codec,
                    "-b:a","192k","-shortest",op],check=True)

def beautifulpad(data, target_len, pattern = bytes([0,255,255,0])):
    if len(data) >= target_len:
        return data[:target_len]
    needed = target_len - len(data)
    full_patterns, remainder = divmod(needed, len(pattern))
    padding = bytes([0,0,0,0])[:remainder] + (pattern * full_patterns)
    return data + padding

def encode(progress,private_key,in_path:Path,out_path:Path,audio_path:Path,w=144,h=144,fps=30):
    now = datetime.now()
    print(now)
    progress = progress or (lambda f,m="":None)
    if w%2 or h%2:
        raise ValueError("Width and Height must be even")
    fb = w*h*4
    out_args = ["-c:v", "ffv1", "-level", "3", "-g", "1","-pix_fmt","bgra"]
    data = Path(in_path).read_bytes()
    if not data:
        raise ValueError("File is empty")
    progress(0.20, "Encoding and Compressing frames")
    data = zlib.compress(data, 9)
    data = Fernet(private_key).encrypt(data)
    filename = in_path.name
    header = MAGIC + len(filename).to_bytes(4,"big")+filename.encode()+len(data).to_bytes(8,"big")+hashlib.sha256(data).digest()
    blob = header+data
    n_frames = math.ceil(len(blob)/fb)
    blob = beautifulpad(blob,n_frames*fb)
    out_pathwo = out_path.with_name(out_path.stem+".noaudio"+out_path.suffix)
    cmd = ["ffmpeg", "-y", "-loglevel", "error", "-f", "rawvideo", 
        "-pix_fmt", pix_fmt, "-s", f"{w}x{h}", "-r", str(fps), 
        "-i", "-", "-c:v","ffv1",*out_args, out_pathwo]
    p = subprocess.Popen(cmd,stdin=subprocess.PIPE)
    progress(0.25, "Writing Video")
    for i in range(n_frames):
        p.stdin.write(blob[i*fb:(i+1)*fb])
        if i%5 == 0:
            progress(0.25+0.60*i/n_frames,f"Frame {i+1}/{n_frames}")
    p.stdin.close()
    if p.wait() != 0:
        raise RuntimeError("ffmpeg Failed")
    if audio_path:
        progress(0.95, "Adding song")
        add_audio(out_pathwo,audio_path,out_path)
        out_pathwo.unlink(missing_ok=True)
    else:
        out_path=out_pathwo
    in_path.unlink()
    audio_path.unlink()
    progress(1.0,"Done")
    return {"file":str(out_path)}


def decode(progress,path:Path,private_key):
    progress = progress or (lambda f, m="": None)
    cmd = ["ffmpeg","-loglevel","error","-i",path,"-f",
           "rawvideo","-pix_fmt",pix_fmt,"-"]
    p = subprocess.Popen(cmd,stdout=subprocess.PIPE)
    raw = p.stdout.read()
    p.wait()
    if raw is None:
        raise ValueError("File is empty")
    if raw[:4] != MAGIC:
        raise PermissionError("Not a PixelVault Video (Magic Byte Missing)")
    progress(0.20,"Reading File")
    filenamelength = int.from_bytes(raw[4:8],"big")
    filename = raw[8:8+filenamelength].decode("utf-8")
    fileindex = 4+filenamelength
    length = int.from_bytes(raw[4+fileindex:fileindex+12],"big")
    digest = raw[fileindex+12:fileindex+44]
    data= raw[fileindex+44:fileindex+44+length]
    if len(data) != length or hashlib.sha256(data).digest() != digest:
        raise PermissionError("Checksum mismatch - the data is damaged")
    try:
        data = Fernet(private_key).decrypt(data)
    except Exception as e:
        raise PermissionError("You don't have permission to decode this file")
    progress(0.70,"Decompressing and Decoding")
    data = zlib.decompress(data)
    outd_path = path.parent.joinpath(filename)
    out = Path(outd_path)
    out.write_bytes(data)
    path.unlink()
    progress(1.0,"Done")
    return {"file":str(outd_path),'ok':True}