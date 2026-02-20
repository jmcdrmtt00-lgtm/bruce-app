from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

load_dotenv()

app = FastAPI(title="Bruce IT Backend")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "https://bruce-app.vercel.app"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health():
    return {"status": "ok"}


# AI endpoints will be added here as Bruce's features grow.
# Example:
#
# @app.post("/api/ask")
# async def ask_ai(request: AskRequest):
#     return await ai_service.ask(request.prompt)
