# PixelVault
Hide any file in an encrypted video.

> Our **Syntax Error 2026** Project

**Turn any file into an encrypted video, and get it back whenever you need it.**
PixelVault compresses and encrypts a file, and then stores its raw bytes as pixels in the frames of a video. The Codec used is *ffv1*, and the container is '.mkv'. Optionally for fun, it can also add a background music to the video.
Upload the video again later, and it will extract, decrypt, decompress and restore the original file. 

It includes a simple user account system.
It uses a symmetric encryption algorithm (Fernet) for encoding the data. The Private key is unique for each user, and is generated at the time of registration, and stored in the database. 
Therefore, there is another part of security,  a video encoded through an acccount can only be decoded using the same account.

It also has an auto-deleting system, which deletes uploaded and generated files after usage and download and when system exits.

### Tech Stack
- **Backend & Engine:** Python, Flask
- **Video Processing:** FFmpeg (FFV1 codec, Matroska container)
- **Cryptography & Compression:** `cryptography`(Fernet), `hashlib` (SHA-256), `zlib`
- **Front End:** HTML, CSS, JS
- **Database:** SQLite


## 🚀 Getting started
 
### Prerequisites
 
- **Python 3**
- **FFmpeg** installed and available on your `PA

 
### Installation
 
```bash
# 1. Clone the repository
git clone https://github.com/divyagra/PixelVault.git
cd PixelVault
 
# 2. (Recommended) create a virtual environment
python -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate
 
# 3. Install dependencies
pip install -r requirements.txt
```
 
### Configuration
 
Create a `.env` file in the project root:
 
```env
SECRET_KEY=replace-with-a-long-random-string
SQLALCHEMY_DATABASE_URI=sqlite:///users.db
```
 
| Variable | Description |
|---|---|
| `SECRET_KEY` | Secret used by Flask to sign session cookies. Use a long, random value. |
| `SQLALCHEMY_DATABASE_URI` | Database connection string. SQLite works out of the box. |
 
You can generate a secret key with:
 
```bash
python -c "import secrets; print(secrets.token_hex(32))"
```
 
### Run
 
```bash
python PixelVault.py
```
 
Then open **http://127.0.0.1:8000** in your browser. Database tables are created automatically on first launch.
 
---
 
## 📖 Usage
 
1. **Register** an account (or log in) on the `/auth` page.
2. Open the **dashboard**.
3. **To encode:** upload a file, optionally add an audio track, choose the resolution and FPS, and start the job. When it finishes, download the resulting `.mkv`.
4. **To decode:** upload a PixelVault `.mkv` and start the job. When it finishes, download your original file.

