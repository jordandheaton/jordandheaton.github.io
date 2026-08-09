"""Minimal Chrome DevTools Protocol client — stdlib only.

Written because this machine has no Node, no Playwright, and no websocket
package, and because the in-app Browser pane runs tabs as document.hidden
(rAF frozen, transforms not applied to layout), which makes it useless for
verifying scroll-driven animation.
"""
import base64
import json
import os
import socket
import struct
import subprocess
import tempfile
import time
import urllib.request

CHROME = r"C:\Program Files\Google\Chrome\Application\chrome.exe"


class WS:
    """Just enough RFC 6455 for CDP: text frames, client-masked, no extensions."""

    def __init__(self, url):
        _, rest = url.split("://", 1)
        hostport, path = rest.split("/", 1)
        host, port = hostport.split(":")
        self.sock = socket.create_connection((host, int(port)))
        key = base64.b64encode(os.urandom(16)).decode()
        req = (
            f"GET /{path} HTTP/1.1\r\nHost: {hostport}\r\n"
            "Upgrade: websocket\r\nConnection: Upgrade\r\n"
            f"Sec-WebSocket-Key: {key}\r\nSec-WebSocket-Version: 13\r\n\r\n"
        )
        self.sock.sendall(req.encode())
        buf = b""
        while b"\r\n\r\n" not in buf:
            buf += self.sock.recv(4096)
        self.buf = buf.split(b"\r\n\r\n", 1)[1]

    def send(self, payload: str):
        data = payload.encode()
        header = bytearray([0x81])
        n = len(data)
        if n < 126:
            header.append(0x80 | n)
        elif n < (1 << 16):
            header.append(0x80 | 126)
            header += struct.pack(">H", n)
        else:
            header.append(0x80 | 127)
            header += struct.pack(">Q", n)
        mask = os.urandom(4)
        header += mask
        self.sock.sendall(bytes(header) + bytes(b ^ mask[i % 4] for i, b in enumerate(data)))

    def _read(self, n):
        while len(self.buf) < n:
            chunk = self.sock.recv(65536)
            if not chunk:
                raise ConnectionError("socket closed")
            self.buf += chunk
        out, self.buf = self.buf[:n], self.buf[n:]
        return out

    def recv(self):
        b1, b2 = self._read(2)
        length = b2 & 0x7F
        if length == 126:
            length = struct.unpack(">H", self._read(2))[0]
        elif length == 127:
            length = struct.unpack(">Q", self._read(8))[0]
        return self._read(length).decode(errors="replace")


class Chrome:
    def __init__(self, port=9333, width=1440, height=900, extra_args=None):
        self.dir = tempfile.mkdtemp(prefix="cdp-")
        args = [CHROME, "--headless=new", f"--remote-debugging-port={port}",
                f"--user-data-dir={self.dir}", f"--window-size={width},{height}",
                "--no-first-run", "--no-default-browser-check", "--disable-gpu",
                "--hide-scrollbars",
                "--allow-file-access-from-files", "--force-device-scale-factor=1",
                "--font-render-hinting=none", "--run-all-compositor-stages-before-draw"]
        args += list(extra_args or [])
        args.append("about:blank")
        self.proc = subprocess.Popen(
            args, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        url = None
        for _ in range(60):
            try:
                pages = json.load(urllib.request.urlopen(f"http://127.0.0.1:{port}/json"))
                for p in pages:
                    if p.get("type") == "page":
                        url = p["webSocketDebuggerUrl"]
                        break
                if url:
                    break
            except Exception:
                pass
            time.sleep(0.25)
        if not url:
            try:
                self.proc.terminate()
            except Exception:
                pass
            raise RuntimeError("Chrome did not expose a page target")
        self.ws = WS(url)
        self.id = 0
        self.send("Page.enable")
        self.send("Runtime.enable")

    def send(self, method, **params):
        self.id += 1
        mid = self.id
        self.ws.send(json.dumps({"id": mid, "method": method, "params": params}))
        while True:
            msg = json.loads(self.ws.recv())
            if msg.get("id") == mid:
                if "error" in msg:
                    raise RuntimeError(f"{method}: {msg['error']}")
                return msg.get("result", {})

    def eval(self, expr, await_promise=False):
        r = self.send("Runtime.evaluate", expression=expr, returnByValue=True,
                      awaitPromise=await_promise)
        if r.get("exceptionDetails"):
            raise RuntimeError(r["exceptionDetails"].get("text", "js error"))
        return r["result"].get("value")

    def metrics(self, width, height, dsf=1):
        self.send("Emulation.setDeviceMetricsOverride", width=width, height=height,
                  deviceScaleFactor=dsf, mobile=False)

    def rect(self, sel):
        return self.eval(
            "(()=>{const e=document.querySelector(%s);if(!e)return null;"
            "const r=e.getBoundingClientRect();"
            "return {x:Math.round(r.x+r.width/2),y:Math.round(r.y+r.height/2),"
            "w:Math.round(r.width),h:Math.round(r.height)};})()" % json.dumps(sel))

    def mouse(self, mtype, x, y, button="none", clicks=0):
        self.send("Input.dispatchMouseEvent", type=mtype, x=x, y=y,
                  button=button, clickCount=clicks)

    def click(self, x, y):
        self.mouse("mouseMoved", x, y)
        self.mouse("mousePressed", x, y, "left", 1)
        self.mouse("mouseReleased", x, y, "left", 1)

    def type_text(self, text):
        for ch in text:
            self.send("Input.dispatchKeyEvent", type="keyDown", text=ch)
            self.send("Input.dispatchKeyEvent", type="keyUp", text=ch)

    def vt_pause(self):
        self.send("Emulation.setVirtualTimePolicy", policy="pause")

    def vt_step(self, ms=16.667):
        t0 = self.eval("performance.now()")
        self.send("Emulation.setVirtualTimePolicy",
                  policy="pauseIfNetworkFetchesPending", budget=ms,
                  maxVirtualTimeTaskStarvationCount=100000)
        for _ in range(400):
            if self.eval("performance.now()") - t0 >= ms - 0.5:
                # Budget expired but headless=new does not run rAF callbacks or
                # advance CSS animations just from the virtual clock ticking --
                # they only run when the compositor actually produces a frame.
                # A cheap discarded screenshot forces that one frame to draw.
                self.send("Page.captureScreenshot", format="jpeg", quality=1)
                return
            time.sleep(0.004)
        raise RuntimeError("virtual time budget never expired")

    def wait_expr(self, expr, timeout=15):
        end = time.time() + timeout
        while time.time() < end:
            if self.eval(expr):
                return True
            time.sleep(0.15)
        raise RuntimeError("timeout waiting for: " + expr)

    def goto(self, url, settle=3.0):
        self.send("Page.navigate", url=url)
        time.sleep(settle)

    def shot(self, path):
        r = self.send("Page.captureScreenshot", format="png")
        with open(path, "wb") as f:
            f.write(base64.b64decode(r["data"]))
        return path

    def shot_jpeg(self, path, quality=90):
        r = self.send("Page.captureScreenshot", format="jpeg", quality=quality)
        with open(path, "wb") as f:
            f.write(base64.b64decode(r["data"]))
        return path

    def close(self):
        try:
            self.proc.terminate()
        except Exception:
            pass
