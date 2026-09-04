# Termux Production Setup Guide (Democrate)

This guide documents the exact steps required to provision a fresh Termux environment for the Democrate school portal, including all necessary dependencies to avoid `maturin`, `pydantic-core`, and `cryptography` build failures.

## 1. System Update
First, ensure Termux packages are completely up to date. During the upgrade, if prompted, press `Y` to accept package maintainer's versions.
```bash
pkg update -y && pkg upgrade -y
```

## 2. Install Core Dependencies & Compilers
Because we added advanced features like **Web Push Notifications** (which relies on `pywebpush` and `cryptography`) and we use FastAPI (which relies on `pydantic-core`), the installation process must compile Rust and C code locally. Termux does not have pre-built Python wheels for these libraries on Android.

Run the following to install Python, Rust, and the required C compilers:
```bash
pkg install -y python rust clang binutils libffi openssl pkg-config make git sqlite nginx
```
*Note: `rust` and `clang` are specifically required to fix the `maturin` wheel building errors you faced previously.*

## 3. Clone the Project
```bash
git clone https://github.com/yatharthp9211/school.git
cd school
```
*(If you haven't pushed your latest code to github yet, make sure to do so from your PC first, or transfer the files over via USB/SFTP).*

## 4. Setup Python Virtual Environment
Always use a virtual environment in Termux to avoid package conflicts.
```bash
cd democrate_backend
python -m venv venv
source venv/bin/activate
```

## 5. Install Python Packages
To prevent the `maturin` and `pydantic` errors from recurring, we must first upgrade the build tools before running the main installation.
```bash
pip install --upgrade pip wheel setuptools
pip install maturin
pip install -r requirements.txt
```
*(Note: Compiling `cryptography` and `pydantic-core` might take 5-15 minutes on a phone CPU. Let it run without interrupting).*

## 6. Setup Nginx (Frontend)
Copy the frontend files to the default Termux Nginx HTML directory:
```bash
cd ../democrate_frontend
mkdir -p $PREFIX/share/nginx/html
cp -r * $PREFIX/share/nginx/html/
```

## 7. Run the Servers

**Start Nginx (Frontend):**
```bash
nginx
```

**Start FastAPI (Backend):**
```bash
cd ../democrate_backend
source venv/bin/activate
uvicorn main:app --host 0.0.0.0 --port 8000
```

## Troubleshooting Past Issues

* **`Failed building wheel for pydantic-core` or `cryptography`**: This happens because `rust` wasn't installed, or `clang` (the C compiler) was missing. Step 2 completely resolves this.
* **Notifications / VAPID Keys**: Since we added push notifications, `pywebpush` relies heavily on `cryptography`. Make sure `cryptography==43.0.1` successfully builds.
* **Blank screen on reload**: If you pull new frontend code, make sure to run `cp -r * $PREFIX/share/nginx/html/` again and restart Nginx if you edited config files.
