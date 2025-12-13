cara setup python:
- buka terminal
- change directory ke python
- jalankan python -m venv venv untuk membuat virtual environement
- aktifkan virtual environtment
    * Windows = venv\Scripts\activate
    * macOS / Linux = source venv/bin/activate
- install requirement python dengan pip install -r requirements.txt

cara setup node_moduls:
- npm install

cara setup database:
-buat database di mysql dengan nama tb_akdat_db
-sesuaika username dan password di .env dan di config/config.json
-jalankan npm run migrate

jika sudah semua bisa jalankan npm run dev