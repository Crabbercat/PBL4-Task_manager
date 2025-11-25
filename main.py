from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse, FileResponse
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware

from backend.api.endpoints import projects, tasks, users, teams
from backend.api.middleware.middleware import logging_middleware, logger
from backend.db.database import Base, engine

app = FastAPI()

frontend_origins = [
    "http://localhost",
    "http://127.0.0.1",
    "http://localhost:5173",
    "http://127.0.0.1:5173"
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=frontend_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# app.mount("/static", StaticFiles(directory="static"), name="static")


app.include_router(tasks.router, prefix="/api/v1", tags=["Tasks"])
app.include_router(projects.router, prefix="/api/v1", tags=["Projects"])
app.include_router(users.router, prefix="/api/v1", tags=["Users"])
app.include_router(teams.router, prefix="/api/v1", tags=["Teams"])
app.middleware("http")(logging_middleware)


@app.on_event("startup")
def startup_db():
    Base.metadata.create_all(bind=engine)


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.exception("Alarm! Global exception!")
    return JSONResponse(
        status_code=500,
        content={"error": "O-o-o-ps! Internal server error"}
    )


@app.get("/")
def read_root():
    return {"message": "Welcome to the Real-Time Task Manager API"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
