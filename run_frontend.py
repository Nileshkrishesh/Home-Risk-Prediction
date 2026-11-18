import os
import sys
import webbrowser
import threading
import time

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
if BASE_DIR not in sys.path:
    sys.path.insert(0, BASE_DIR)

from backend.app import app

def open_browser(port):
    time.sleep(1.2)
    url = f"http://localhost:{port}"
    print(f"\n[Home Credit Risk AI] Opening browser at {url} ...")
    webbrowser.open(url)

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    print("=" * 60)
    print("   Home Credit Risk AI - Underwriting & Prediction Hub   ")
    print(f"   Server running at: http://localhost:{port}           ")
    print("   Press CTRL+C to stop the server                      ")
    print("=" * 60)
    
    # Launch browser automatically
    threading.Thread(target=open_browser, args=(port,), daemon=True).start()
    
    app.run(host="127.0.0.1", port=port, debug=False)
