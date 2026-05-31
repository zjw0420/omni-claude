from fastapi import FastAPI, HTTPException, Header
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
import httpx, json, os, time, jwt

app = FastAPI()
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_credentials=True, allow_methods=["*"], allow_headers=["*"])

JWT_SECRET = os.getenv("JWT_SECRET", "dev-secret-set-in-production")
JWT_ALGORITHM = "HS256"
JWT_EXPIRY_HOURS = 24

MODELS = {
    "deepseek-v4-pro": {"name": "DeepSeek V4 Pro", "base_url": "https://api.deepseek.com/v1", "model": "deepseek-chat"},
    "qwen-max": {"name": "Qwen Max", "base_url": "https://dashscope.aliyuncs.com/compatible-mode/v1", "model": "qwen-max"},
    "doubao-pro": {"name": "Doubao Pro", "base_url": "https://ark.cn-beijing.volces.com/api/v3", "model": "doubao-pro-32k"},
}


class StartRequest(BaseModel):
    model_id: str
    api_key: str


class ChatRequest(BaseModel):
    messages: list


def create_session_token(model_id: str, api_key: str) -> str:
    cfg = MODELS[model_id]
    now = int(time.time())
    payload = {
        "model_id": model_id, "api_key": api_key,
        "base_url": cfg["base_url"], "model": cfg["model"],
        "model_name": cfg["name"], "iat": now,
        "exp": now + JWT_EXPIRY_HOURS * 3600,
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def decode_session_token(token: str) -> dict:
    try:
        return jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Session token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid session token")


@app.get("/health")
async def health():
    return {"status": "ok"}


@app.post("/start")
async def start(req: StartRequest):
    if req.model_id not in MODELS:
        raise HTTPException(status_code=400, detail=f"Unknown model: {req.model_id}")
    token = create_session_token(req.model_id, req.api_key)
    return {"token": token, "model_name": MODELS[req.model_id]["name"], "mode": "direct"}


@app.post("/login")
async def login(req: StartRequest):
    return await start(req)


@app.post("/chat")
async def chat(req: ChatRequest, authorization: str = Header(None)):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing or invalid Authorization header")
    token = authorization[7:]
    session = decode_session_token(token)
    NL = chr(10)

    async def generate():
        async with httpx.AsyncClient(timeout=120.0) as client:
            try:
                async with client.stream(
                    "POST", f"{session['base_url']}/chat/completions",
                    headers={"Authorization": f"Bearer {session['api_key']}", "Content-Type": "application/json"},
                    json={"model": session["model"], "messages": req.messages, "stream": True},
                ) as resp:
                    if resp.status_code != 200:
                        body = await resp.aread()
                        err = json.dumps({"error": "Upstream error " + str(resp.status_code)})
                        yield f"data: {err}{NL}{NL}"
                        yield f"data: [DONE]{NL}{NL}"
                        return
                    async for line in resp.aiter_lines():
                        if line:
                            yield f"{line}{NL}{NL}"
            except Exception as e:
                yield f"data: {json.dumps({'error': str(e)})}{NL}{NL}"
                yield f"data: [DONE]{NL}{NL}"

    return StreamingResponse(generate(), media_type="text/event-stream")


# Serve frontend static files - MUST be after all API routes
STATIC_DIR = os.path.join(os.path.dirname(__file__), "static")
if os.path.isdir(STATIC_DIR):
    app.mount("/", StaticFiles(directory=STATIC_DIR, html=True), name="static")

@app.get("/debug")
async def debug():
    import os as _os
    wd = _os.getcwd()
    items = _os.listdir(wd)
    sub = _os.listdir("static") if _os.path.isdir("static") else "NO STATIC DIR"
    return {"cwd": wd, "items": items, "static": sub}
