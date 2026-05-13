from __future__ import annotations

from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, Path, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.api.auth_dependencies import require_standard_user
from app.db.session import get_db
from app.models.career_development_goal_planning_task import CareerDevelopmentGoalPlanningTask
from app.models.user import User
from app.utils.datetime_utils import utc_now

router = APIRouter(
    prefix="/api/career-development-report",
    tags=["goal-setting-path-planning"],
)

# ── Request / Response schemas ─────────────────────────────────────


class GoalPlanCreateRequest(BaseModel):
    student_id: str = Field(..., description="Student identifier")
    goal: str = Field(..., min_length=1, description="Goal description")
    current_skills: list[str] = Field(default_factory=list)


class GoalPlanCreateResponse(BaseModel):
    plan_id: str
    steps: list[dict] = Field(default_factory=list)


class GoalPlanUpdateRequest(BaseModel):
    goal: str | None = None
    steps: list[dict] | None = None


class ProgressUpdateRequest(BaseModel):
    skill_id: str = Field(..., min_length=1)
    mastery_status: str = Field(..., min_length=1)


class ProgressResponse(BaseModel):
    plan_id: str
    completed: int
    total: int
    percentage: float


class LearningPathDetail(BaseModel):
    id: str
    goal: str = ""
    steps: list[dict] = Field(default_factory=list)
    progress: dict = Field(default_factory=dict)


# ── Endpoints ──────────────────────────────────────────────────────


@router.post("/goal-setting-path-planning")
def create_goal_plan(
    body: GoalPlanCreateRequest,
    current_user: User = Depends(require_standard_user),
    db: Session = Depends(get_db),
):
    """Create a new goal-setting path planning task.

    Returns a plan_id for subsequent progress tracking.
    """
    task_id = f"goal_{uuid4().hex[:16]}"
    import json

    task = CareerDevelopmentGoalPlanningTask(
        id=task_id,
        user_id=current_user.id,
        favorite_id=0,
        status="queued",
        progress=0.0,
        result_json=json.dumps(
            {"goal": body.goal, "steps": _build_default_steps(body.goal, body.current_skills)},
            ensure_ascii=False,
        ),
    )
    db.add(task)
    db.commit()
    db.refresh(task)

    result = json.loads(task.result_json) if task.result_json else {}
    return GoalPlanCreateResponse(
        plan_id=task.id,
        steps=result.get("steps", []),
    )


@router.put("/goal-setting-path-planning/{plan_id}")
def update_goal_plan(
    plan_id: str,
    body: GoalPlanUpdateRequest,
    current_user: User = Depends(require_standard_user),
    db: Session = Depends(get_db),
):
    task = db.query(CareerDevelopmentGoalPlanningTask).filter(
        CareerDevelopmentGoalPlanningTask.id == plan_id,
        CareerDevelopmentGoalPlanningTask.user_id == current_user.id,
    ).first()
    if not task:
        raise HTTPException(status_code=404, detail="PLAN_NOT_FOUND")

    import json
    result = json.loads(task.result_json) if task.result_json else {}
    if body.goal is not None:
        result["goal"] = body.goal
    if body.steps is not None:
        result["steps"] = body.steps

    task.result_json = json.dumps(result, ensure_ascii=False)
    task.updated_at = utc_now()
    db.commit()

    return {"updated": True, "plan_id": plan_id}


@router.get("/goal-setting-path-planning/{plan_id}/progress")
def get_plan_progress(
    plan_id: str,
    current_user: User = Depends(require_standard_user),
    db: Session = Depends(get_db),
):
    task = db.query(CareerDevelopmentGoalPlanningTask).filter(
        CareerDevelopmentGoalPlanningTask.id == plan_id,
        CareerDevelopmentGoalPlanningTask.user_id == current_user.id,
    ).first()
    if not task:
        raise HTTPException(status_code=404, detail="PLAN_NOT_FOUND")

    import json
    result = json.loads(task.result_json) if task.result_json else {}
    steps = result.get("steps", [])
    total = len(steps)
    completed = sum(1 for s in steps if isinstance(s, dict) and s.get("status") == "completed")

    return ProgressResponse(
        plan_id=plan_id,
        completed=completed,
        total=total,
        percentage=round(completed / total * 100, 1) if total > 0 else 0.0,
    )


@router.post("/goal-setting-path-planning/{plan_id}/progress")
def update_plan_progress(
    plan_id: str,
    body: ProgressUpdateRequest,
    current_user: User = Depends(require_standard_user),
    db: Session = Depends(get_db),
):
    task = db.query(CareerDevelopmentGoalPlanningTask).filter(
        CareerDevelopmentGoalPlanningTask.id == plan_id,
        CareerDevelopmentGoalPlanningTask.user_id == current_user.id,
    ).first()
    if not task:
        raise HTTPException(status_code=404, detail="PLAN_NOT_FOUND")

    import json
    result = json.loads(task.result_json) if task.result_json else {}
    steps = result.get("steps", [])

    updated = False
    for step in steps:
        if isinstance(step, dict) and step.get("skill_id") == body.skill_id:
            step["mastery_status"] = body.mastery_status
            step["status"] = "completed" if body.mastery_status == "mastered" else "in_progress"
            updated = True

    if not updated:
        steps.append({
            "skill_id": body.skill_id,
            "mastery_status": body.mastery_status,
            "status": "completed" if body.mastery_status == "mastered" else "in_progress",
        })

    result["steps"] = steps
    task.result_json = json.dumps(result, ensure_ascii=False)
    task.progress = _calc_progress(steps)
    task.updated_at = utc_now()
    db.commit()

    return {"updated_progress": {"plan_id": plan_id, "steps": steps}}


@router.get("/learning-path/{plan_id}")
def get_learning_path(
    plan_id: str,
    current_user: User = Depends(require_standard_user),
    db: Session = Depends(get_db),
):
    """Get learning plan detail (read_plan tool endpoint).

    Accepts plan_id (which is a CareerDevelopmentGoalPlanningTask id).
    Returns the full plan with goal, steps, and progress.
    """
    task = db.query(CareerDevelopmentGoalPlanningTask).filter(
        CareerDevelopmentGoalPlanningTask.id == plan_id,
        CareerDevelopmentGoalPlanningTask.user_id == current_user.id,
    ).first()
    if not task:
        raise HTTPException(status_code=404, detail="PLAN_NOT_FOUND")

    import json
    result = json.loads(task.result_json) if task.result_json else {}
    steps = result.get("steps", [])
    total = len(steps)
    completed = sum(1 for s in steps if isinstance(s, dict) and s.get("status") == "completed")

    return {
        "id": task.id,
        "goal": result.get("goal", ""),
        "steps": steps,
        "progress": {
            "completed": completed,
            "total": total,
            "percentage": round(completed / total * 100, 1) if total > 0 else 0.0,
        },
    }


# ── Helpers ────────────────────────────────────────────────────────


def _build_default_steps(goal: str, current_skills: list[str]) -> list[dict]:
    """Generate default learning steps from goal and current skills."""
    steps: list[dict] = []
    for i, skill in enumerate(current_skills):
        steps.append({
            "step": i + 1,
            "skill_id": skill,
            "mastery_status": "in_progress",
            "status": "in_progress",
        })
    if not steps:
        steps.append({"step": 1, "skill_id": goal, "mastery_status": "in_progress", "status": "in_progress"})
    return steps


def _calc_progress(steps: list[dict]) -> float:
    if not steps:
        return 0.0
    completed = sum(1 for s in steps if isinstance(s, dict) and s.get("status") == "completed")
    return round(completed / len(steps), 3)
