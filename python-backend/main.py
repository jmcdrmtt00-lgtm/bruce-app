from __future__ import annotations

import asyncio
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv
from services import ai_service

load_dotenv()

logger = logging.getLogger(__name__)


async def _email_poll_loop() -> None:
    """Background task: poll Gmail for new IT ticket emails every 2 minutes."""
    from services.gmail_poller import poll_once
    while True:
        try:
            await asyncio.to_thread(poll_once)
        except Exception as exc:
            logger.error("Email poll error: %s", exc)
        await asyncio.sleep(120)


@asynccontextmanager
async def lifespan(app: FastAPI):
    task = asyncio.create_task(_email_poll_loop())
    yield
    task.cancel()


app = FastAPI(title="Bruce IT Backend", lifespan=lifespan)

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


class AdvisePlanRequest(BaseModel):
    question: str
    in_progress_tasks: list[dict] = []
    user_email: str = ""


class AdviseAnswerRequest(BaseModel):
    question: str
    in_progress_tasks: list[dict] = []
    lookup_description: str | None = None
    sql_results: list[dict] = []
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


@app.post("/api/advise/plan")
async def advise_plan(request: AdvisePlanRequest):
    result = await ai_service.advise_plan(request.question, request.in_progress_tasks, request.user_email)
    return result


@app.post("/api/advise/answer")
async def advise_answer(request: AdviseAnswerRequest):
    answer = await ai_service.advise_answer(
        request.question,
        request.in_progress_tasks,
        request.lookup_description,
        request.sql_results,
        request.user_email,
    )
    return {"answer": answer}


@app.post("/api/check-suggestions")
async def check_suggestions(request: CheckSuggestionsRequest):
    suggestions = await ai_service.check_suggestions(request.completed_tasks, request.user_email)
    return {"suggestions": suggestions}


class SendReplyRequest(BaseModel):
    incident_id: str
    to: str
    subject: str
    body: str


@app.post("/api/send-reply")
async def send_reply_ep(request: SendReplyRequest):
    from services.gmail_poller import _gmail_service, _send_email, _reply_subject, _sb_patch, _sb_get
    from fastapi import HTTPException
    try:
        # Look up the org slug so Reply-To is set correctly
        org_slug = None
        try:
            incidents = _sb_get("incidents", {"id": f"eq.{request.incident_id}", "select": "org_id", "limit": "1"})
            if incidents and incidents[0].get("org_id"):
                orgs = _sb_get("orgs", {"id": f"eq.{incidents[0]['org_id']}", "select": "slug", "limit": "1"})
                if orgs:
                    org_slug = orgs[0].get("slug")
        except Exception:
            pass
        service = _gmail_service()
        reply_to_addr = f"admin+{org_slug}@lm-intel.ai" if org_slug else None
        _send_email(service, request.to, _reply_subject(request.subject), request.body, reply_to=reply_to_addr)
        _sb_patch(f"incidents?id=eq.{request.incident_id}", {"awaiting_reply": True})
        return {"ok": True}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


class MatchProblemTypeRequest(BaseModel):
    description: str
    problem_types: list[str]
    user_email: str | None = None


class DiagnoseRequest(BaseModel):
    problem_type: str
    stage: str = "symptoms"
    task_details: str | None = None
    information: str | None = None
    task_fields: dict | None = None
    conversation: list[dict] | None = None
    user_email: str | None = None
    tool_call: dict | None = None
    tool_result: str | None = None


@app.post("/api/match-problem-type")
async def match_problem_type_ep(req: MatchProblemTypeRequest):
    matches = await ai_service.match_problem_type(req.description, req.problem_types, req.user_email or "")
    return {"matches": matches}


@app.post("/api/diagnose")
async def diagnose_ep(req: DiagnoseRequest):
    return await ai_service.diagnose(
        req.problem_type,
        req.stage,
        req.task_details,
        req.information,
        req.task_fields,
        req.conversation,
        req.user_email or "",
        req.tool_call,
        req.tool_result,
    )
