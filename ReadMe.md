# PAM Network Automation

Merkezi ağ cihazı yönetimi ve SSH terminal uygulaması  
**GitHub:** [mratsag/pam-network-automation](https://github.com/mratsag/pam-network-automation)

---

## İçindekiler

- [Proje Hakkında](#proje-hakkında)
- [Kurulum](#kurulum)
  - [Gereksinimler](#gereksinimler)
  - [Kaynak Kodun İndirilmesi (GitHub'dan)](#kaynak-kodun-indirilmesi-githubdan)
  - [Python Sanal Ortam Oluşturma ve Paket Kurulumu](#python-sanal-ortam-oluşturma-ve-paket-kurulumu)
  - [Backend Başlatma (FastAPI)](#backend-başlatma-fastapi)
  - [Frontend Kurulumu](#frontend-kurulumu)
  - [Docker ile Çalıştırma (Opsiyonel)](#docker-ile-çalıştırma-opsiyonel)
- [Klasör Yapısı](#klasör-yapısı)
- [Kullanım](#kullanım)
- [Geliştirici Notları](#geliştirici-notları)
- [Sorun Giderme](#sorun-giderme)
- [Lisans](#lisans)

---

## Proje Hakkında

Bu proje, ağ cihazlarını merkezi olarak yönetmek ve SSH üzerinden komut çalıştırmak için geliştirilmiş bir web uygulamasıdır.  
Backend kısmı Python (FastAPI) ile, frontend ise saf HTML/CSS/JS ile yazılmıştır.  
Docker desteği ile kolayca ayağa kaldırılabilir.

---

## Kurulum

### Gereksinimler

- **Python 3.9+** (Backend için)
- **Git** (Kaynak kodu indirmek için)
- **Docker & Docker Compose** (Opsiyonel, kolay kurulum için)
- **Bir web tarayıcısı** (Frontend için)
- (Opsiyonel) **Node.js** sadece frontend geliştirme için

---

### Kaynak Kodun İndirilmesi (GitHub'dan)

```bash
# GitHub'dan projeyi klonlayın
git clone https://github.com/mratsag/pam-network-automation.git
cd pam-network-automation
```

---

### Python Sanal Ortam Oluşturma ve Paket Kurulumu

1. **Python sanal ortamı oluşturun:**
   ```bash
   python3 -m venv venv
   ```

2. **Sanal ortamı aktif edin:**
   - MacOS/Linux:
     ```bash
     source venv/bin/activate
     ```
   - Windows:
     ```cmd
     venv\Scripts\activate
     ```

3. **Gerekli Python paketlerini yükleyin:**
   ```bash
   pip install --upgrade pip
   pip install -r requirements.txt
   ```

> **Not:**  
> Eğer `pip` veya `venv` komutları bulunamazsa, Python'unuzun doğru kurulu olduğundan ve PATH'e eklendiğinden emin olun.

---

### Backend Başlatma (FastAPI)

```bash
uvicorn backend.app.main:app --reload --host 0.0.0.0 --port 8000
```

- API dokümantasyonu: [http://localhost:8000/docs](http://localhost:8000/docs)

---

### Frontend Kurulumu

Frontend saf HTML, CSS ve JavaScript ile yazılmıştır.  
Ekstra bir derleme/geliştirme aracı gerekmez.

1. **Frontend'i başlatmak için:**
   - `frontend/pages/index.html` dosyasını tarayıcıda açabilirsiniz.
   - Veya bir HTTP sunucusu ile çalıştırabilirsiniz:

   ```bash
   # Python ile basit bir sunucu:
   cd frontend
   python3 -m http.server 8080
   # Ardından http://localhost:8080/pages/index.html adresine gidin.
   ```

2. **Terminal ekranı için:**
   - `frontend/pages/terminal.html` dosyasını açın veya yukarıdaki sunucu ile erişin.

> **Not:**  
> - Frontend, backend'e `http://localhost:8000` üzerinden istek atar.  
>   Eğer backend farklı bir portta çalışıyorsa, JS dosyalarındaki API URL'lerini güncelleyin.

---

### Docker ile Çalıştırma (Opsiyonel)

Projeyi Docker ile kolayca ayağa kaldırabilirsiniz.

1. **Docker ve Docker Compose kurulu olmalı.**
2. **Aşağıdaki komut ile backend'i başlatın:**

   ```bash
   docker-compose up --build
   ```

   - Backend API: [http://localhost:8000](http://localhost:8000)
   - (İleride) PostgreSQL servisi için: `docker-compose --profile database up`

3. **Frontend için:**
   - Docker Compose sadece backend'i başlatır.
   - Frontend dosyalarını bir HTTP sunucusunda (ör. nginx, Apache, Python http.server) yayınlayın.

---

## Klasör Yapısı

```
pam-network-automation/
│
├── backend/
│   ├── app/
│   │   ├── main.py           # FastAPI ana uygulama
│   │   ├── json_db.py        # JSON tabanlı veri işlemleri
│   │   ├── db.json           # Cihaz ve kullanıcı veritabanı (JSON)
│   │   ├── routers/
│   │   │   ├── auth.py
│   │   │   ├── connections.py
│   │   └── utils/
│   │       └── ssh_connector.py
│   ├── requirements.txt      # (boş, ana gereksinimler kökte)
│   └── Dockerfile            # Backend için Dockerfile
│
├── frontend/
│   ├── assets/
│   │   ├── css/
│   │   │   ├── common.css
│   │   │   ├── main.css
│   │   │   └── terminal.css
│   │   └── js/
│   │       ├── api/
│   │       ├── components/
│   │       └── services/
│   └── pages/
│       ├── index.html
│       ├── login.html
│       └── terminal.html
│
├── requirements.txt          # Python bağımlılıkları (backend için)
├── docker-compose.yml        # Tüm servislerin orkestrasyonu
└── README.md                 # (Bu dosya)
```

---

## Kullanım

1. **Cihaz ekleyin:**  
   - API üzerinden veya arayüzden yeni cihaz ekleyebilirsiniz.

2. **SSH ile bağlanın:**  
   - Terminal arayüzünden cihaz seçip komut gönderebilirsiniz.

3. **Komut geçmişi ve hızlı komutlar:**  
   - Terminalde daha önce gönderilen komutlara ve sık kullanılanlara kolayca ulaşabilirsiniz.

---

## Geliştirici Notları

- **Backend:**  
  - FastAPI ile yazılmıştır.  
  - Cihaz ve kullanıcı verileri JSON dosyasında tutulur.
  - SSH bağlantıları için `paramiko`, `netmiko`, `asyncssh` kullanılır.

- **Frontend:**  
  - Vanilla JS, modüler yapı.
  - Komponentler ve servisler ayrılmıştır.
  - Responsive ve modern tasarım.

- **Güvenlik:**  
  - Geliştirme ortamında CORS açıktır, prod ortamda kısıtlayın.
  - Şifreler frontend'de encode edilse de, gerçek güvenlik için backend ve ağ güvenliğine dikkat edin.

---

## Sorun Giderme

- **Backend başlamıyor:**  
  - Python sürümünüzü ve bağımlılıkları kontrol edin.
  - `db.json` dosyasının yazılabilir olduğundan emin olun.

- **Frontend API'ye bağlanamıyor:**  
  - Backend'in çalıştığından ve doğru portta olduğundan emin olun.
  - Tarayıcı konsolunda hata mesajlarını kontrol edin.

- **Docker ile ilgili sorunlar:**  
  - Docker ve Docker Compose sürümleriniz güncel mi?
  - Port çakışmalarını kontrol edin.

---

## Lisans

Bu proje MIT lisansı ile lisanslanmıştır.

---

**Kaynak:**  
[https://github.com/mratsag/pam-network-automation](https://github.com/mratsag/pam-network-automation)