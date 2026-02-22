from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv
from services import ai_service

load_dotenv()

app = FastAPI(title="Bruce IT Backend")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:3002", "https://bruce-app-ryrt.vercel.app"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class AskRequest(BaseModel):
    prompt: str
    system: str = ""


class SummarizeRequest(BaseModel):
    description: str


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/api/ask")
async def ask(request: AskRequest):
    text = await ai_service.ask(request.prompt, request.system)
    return {"text": text}


@app.post("/api/summarize")
async def summarize(request: SummarizeRequest):
    title = await ai_service.summarize_incident(request.description)
    return {"title": title}
