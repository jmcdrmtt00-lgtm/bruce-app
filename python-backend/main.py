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
    user_email: str = ""


class SummarizeRequest(BaseModel):
    description: str
    user_email: str = ""


class GenerateSqlRequest(BaseModel):
    question: str
    target: str  # "tasks" or "assets"
    user_email: str = ""


class CheckSuggestionsRequest(BaseModel):
    completed_tasks: list[dict]
    user_email: str = ""


class TrackClickRequest(BaseModel):
    user_email: str = ""


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/api/track-click")
async def track_click(request: TrackClickRequest):
    """Increment the click counter for a user — called from the frontend on page navigation."""
    if request.user_email:
        from services.headlights_tracker import track_activity
        track_activity(request.user_email, clicks=1)
    return {"ok": True}


@app.post("/api/track-upload")
async def track_upload(request: TrackClickRequest):
    """Increment the uploads counter for a user — called after a successful inventory upload."""
    if request.user_email:
        from services.headlights_tracker import track_activity
        track_activity(request.user_email, uploads=1)
    return {"ok": True}


@app.post("/api/ask")
async def ask(request: AskRequest):
    text = await ai_service.ask(request.prompt, request.system, request.user_email)
    return {"text": text}


@app.post("/api/summarize")
async def summarize(request: SummarizeRequest):
    title = await ai_service.summarize_incident(request.description, request.user_email)
    return {"title": title}


@app.post("/api/generate-sql")
async def generate_sql(request: GenerateSqlRequest):
    sql = await ai_service.generate_sql(request.question, request.target, request.user_email)
    return {"sql": sql}


@app.post("/api/check-suggestions")
async def check_suggestions(request: CheckSuggestionsRequest):
    suggestions = await ai_service.check_suggestions(request.completed_tasks, request.user_email)
    return {"suggestions": suggestions}
