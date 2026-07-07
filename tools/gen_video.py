# -*- coding: utf-8 -*-
"""Agnes Video V2.0 图生视频:舰队光速航行(首页主视觉动起来)
建任务 → 轮询 → 下载 mp4 到 assets/raw_fleet_video.mp4
"""
import json, os, sys, time, urllib.request

KEY = open(os.path.expanduser("~/.agnes_key"), encoding="utf-8").read().strip()
HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
API = "https://apihub.agnes-ai.com"

# github.io 的取图节点访问不到,走 jsDelivr 的 GitHub CDN 镜像
IMAGE_URL = "https://cdn.jsdelivr.net/gh/EthanZhao529/three-body-site@main/assets/fleet_lightspeed.png"

PROMPT = (
    "Bring this image to life as an epic cinematic space shot: the fleet of dark "
    "teardrop-shaped warships cruises steadily forward away from the distant vanishing "
    "point, hulls gliding with slow majestic motion, subtle parallax between the huge "
    "flagship in the lower-left foreground and the hundreds of distant ships. The "
    "blue-white curvature-drive wakes shimmer and flow, with pulses of light streaming "
    "backward along the trails toward the vanishing point on the right. Stars drift very "
    "slowly; the faint dark red nebula glows subtly. The camera performs a very slow "
    "forward dolly alongside the flagship. Keep ship designs, composition, pure black "
    "space and lighting fully consistent with the source image. Smooth constant motion, "
    "no cuts, no camera shake, seamless cinematic loop feel."
)
NEG = ("text, watermark, subtitles, logo, letters, flicker, jitter, camera shake, cuts, "
       "warping, morphing, deformation, extra objects, low quality, blur")

def post(path, body):
    req = urllib.request.Request(API + path, data=json.dumps(body).encode("utf-8"),
        headers={"Authorization": "Bearer " + KEY, "Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=120) as r:
        return json.loads(r.read().decode("utf-8"))

def get(path):
    req = urllib.request.Request(API + path,
        headers={"Authorization": "Bearer " + KEY})
    with urllib.request.urlopen(req, timeout=120) as r:
        return json.loads(r.read().decode("utf-8"))

task = post("/v1/videos", {
    "model": "agnes-video-v2.0",
    "prompt": PROMPT,
    "negative_prompt": NEG,
    "image": IMAGE_URL,
    "width": 1920, "height": 1080,
    "num_frames": 241, "frame_rate": 24,
    "seed": 42,
})
print("task created:", json.dumps({k: task.get(k) for k in
    ("task_id", "video_id", "status", "seconds", "size")}, ensure_ascii=False), flush=True)
vid = task.get("video_id") or task.get("task_id") or task.get("id")

t0 = time.time()
while True:
    time.sleep(20)
    try:
        r = get("/agnesapi?video_id=" + vid)
    except Exception as e:
        print("poll error:", repr(e)[:120], flush=True)
        continue
    st = r.get("status")
    print("[%4ds] %s progress=%s" % (time.time() - t0, st, r.get("progress")), flush=True)
    if st == "completed":
        url = r["url"]
        dst = os.path.join(HERE, "assets", "raw_fleet_video.mp4")
        print("downloading", url, flush=True)
        urllib.request.urlretrieve(url, dst)
        print("SAVED", dst, os.path.getsize(dst) // 1024, "KB", flush=True)
        break
    if st == "failed":
        print("FAILED:", json.dumps(r.get("error"), ensure_ascii=False), flush=True)
        sys.exit(1)
    if time.time() - t0 > 1800:
        print("TIMEOUT 30min", flush=True)
        sys.exit(1)
