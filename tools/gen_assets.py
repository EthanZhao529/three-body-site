# -*- coding: utf-8 -*-
"""Agnes AI 批量生成三体网站精加工美术素材 → assets/
用法: python tools/gen_assets.py [名字...]   不带参数=全部生成
坑位规避: 每条 prompt 都加 no-text 咒语;纯物体/风景构图,无真人脸。
"""
import json, os, sys, urllib.request

KEY = open(os.path.expanduser("~/.agnes_key"), encoding="utf-8").read().strip()
HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(HERE, "assets")
os.makedirs(OUT, exist_ok=True)

NO_TEXT = " Absolutely no text, no letters, no words, no numbers, no watermark, no logo."

ASSETS = {
    # 首屏:深空星云,暗红金色调,留中央暗区放大字
    "hero_nebula": ("1344x768",
        "Vast deep space nebula, dark cinematic sci-fi matte painting, deep crimson and "
        "amber gas clouds on the edges, near-black empty void in the center, tiny sharp "
        "stars scattered, three distant glowing suns aligned subtly, ultra detailed, "
        "8k concept art, moody, majestic." + NO_TEXT),
    # 水滴:镜面金属泪滴探测器,产品摄影级
    "droplet": ("1024x1024",
        "One single hyperrealistic chrome teardrop-shaped space probe floating in pitch "
        "black space, flawless mirror surface reflecting faint starlight, elegant elongated "
        "water-drop silhouette with a perfectly rounded head and tapering tail, dramatic "
        "rim light, studio product photography, extreme detail, dark background." + NO_TEXT),
    # 红岸基地:巨型抛物面天线剪影
    "red_coast": ("1344x768",
        "Colossal parabolic radio telescope antenna silhouetted on a remote mountain ridge "
        "at dusk, deep blood-red sky with heavy clouds, retro 1970s sci-fi atmosphere, "
        "pine forest in shadow below, cinematic wide shot, volumetric light, film grain, "
        "matte painting." + NO_TEXT),
    # 乱纪元:三日凌空炙烤下的干裂行星地表
    "chaotic_era": ("1344x768",
        "Alien desert planet surface cracked and dehydrated under three blazing suns of "
        "different sizes in the sky, harsh golden light, heat haze, epic scale, lonely "
        "barren landscape, cinematic sci-fi concept art, ultra detailed." + NO_TEXT),
    # 作品卡 x4:同一暗色系列的抽象科幻艺术
    "work_ship": ("1024x1024",
        "Sleek dark spacecraft silhouette drifting through space, thin red engine light "
        "trail, minimalist dark sci-fi artwork, near-black palette with one crimson accent, "
        "elegant composition, concept art." + NO_TEXT),
    "work_planet": ("1024x1024",
        "A small lonely planet half lit by a dying red sun, thin ring of dust, deep black "
        "space, minimalist dark sci-fi artwork, crimson and charcoal palette, elegant, "
        "concept art." + NO_TEXT),
    "work_monolith": ("1024x1024",
        "A mysterious dark monolith standing in empty space with faint red energy lines "
        "across its surface, minimalist dark sci-fi artwork, near-black palette with "
        "crimson accent, elegant composition, concept art." + NO_TEXT),
    "work_orbits": ("1024x1024",
        "Abstract orbital diagram made of thin glowing red and white curved light trails "
        "of three celestial bodies weaving a chaotic knot in dark space, long exposure "
        "light painting style, elegant minimalist dark artwork." + NO_TEXT),
}

def gen(name):
    size, prompt = ASSETS[name]
    body = json.dumps({
        "model": "agnes-image-2.0-flash",
        "prompt": prompt,
        "size": size,
        "extra_body": {"response_format": "url"},
    }).encode("utf-8")
    req = urllib.request.Request(
        "https://apihub.agnes-ai.com/v1/images/generations",
        data=body,
        headers={"Authorization": "Bearer " + KEY, "Content-Type": "application/json"},
    )
    with urllib.request.urlopen(req, timeout=180) as r:
        data = json.loads(r.read().decode("utf-8"))
    url = data["data"][0]["url"]
    dst = os.path.join(OUT, name + ".png")
    urllib.request.urlretrieve(url, dst)
    print("OK", name, os.path.getsize(dst) // 1024, "KB")

names = sys.argv[1:] or list(ASSETS)
for n in names:
    try:
        gen(n)
    except Exception as e:
        print("FAIL", n, repr(e)[:200])
