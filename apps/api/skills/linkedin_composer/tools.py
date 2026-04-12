import json
from langchain_core.tools import tool
from agents import get_model
from langchain_core.messages import SystemMessage, HumanMessage
import os


@tool
def draft_linkedin_post(topic: str, tone: str = "professional", length: str = "medium") -> str:
    """
    Draft a LinkedIn post on the given topic with the specified tone and length.
    Tone options: professional, thought_leadership, casual, storytelling
    Length options: short (~150 words), medium (~300 words), long (~500 words)
    """
    length_map = {"short": 150, "medium": 300, "long": 500}
    word_count = length_map.get(length, 300)

    tone_instructions = {
        "professional": "Write in a polished, authoritative tone. Use clear, direct language.",
        "thought_leadership": "Write as an industry expert sharing unique insights. Be bold and insightful.",
        "casual": "Write in a friendly, conversational tone. Use contractions and feel relatable.",
        "storytelling": "Use a narrative arc: situation → challenge → lesson → call to action."
    }

    llm = get_model("openai", os.getenv("OPENAI_API_KEY"))
    prompt = f"""Write a LinkedIn post about: {topic}

Tone style: {tone_instructions.get(tone, tone_instructions['professional'])}
Target length: ~{word_count} words

Requirements:
- Start with a compelling hook (no generic openers like "I'm excited to share")
- Include 1-2 concrete insights or data points if relevant
- End with a clear call to action or thought-provoking question
- Add 3-5 relevant hashtags at the end
- Format with line breaks for readability

Return ONLY the post content, no preamble."""

    response = llm.invoke([
        SystemMessage(content="You are an expert LinkedIn content creator known for engaging, authentic posts."),
        HumanMessage(content=prompt)
    ])

    result = {
        "status": "success",
        "draft": response.content,
        "topic": topic,
        "tone": tone,
        "length": length,
        "word_count": len(response.content.split()),
        "ui_directive": {
            "view": "linkedin_composer",
            "data": {
                "draft": response.content,
                "topic": topic,
                "tone": tone
            }
        }
    }
    return json.dumps(result)


@tool
def get_post_suggestions() -> str:
    """
    Suggest LinkedIn post topics based on the user's recent calendar activities and interests.
    """
    from skills.linkedin_composer._context import CURRENT_USER_ID
    from database import SessionLocal
    import models

    suggestions = []
    with SessionLocal() as db:
        # Get recent calendar events as inspiration
        recent = db.query(models.CalendarEvent).filter(
            models.CalendarEvent.user_id == CURRENT_USER_ID
        ).order_by(models.CalendarEvent.start_time.desc()).limit(5).all()

        # Get user interests
        pref = db.query(models.UserPreference).filter(
            models.UserPreference.user_id == CURRENT_USER_ID
        ).first()
        interests = pref.interests if pref and pref.interests else ["AI", "Productivity"]

    llm = get_model("openai", os.getenv("OPENAI_API_KEY"))
    events_str = ", ".join([e.title for e in recent]) if recent else "general activities"
    prompt = f"""Based on these recent activities: {events_str}
And interests: {interests}

Suggest 4 compelling LinkedIn post topics. Return as JSON array of objects with:
- topic: the post topic
- hook: a one-sentence compelling opener
- tone: suggested tone (professional/thought_leadership/casual/storytelling)

Return ONLY JSON."""

    response = llm.invoke([HumanMessage(content=prompt)])
    try:
        suggestions = json.loads(response.content.replace("```json", "").replace("```", "").strip())
    except Exception:
        suggestions = [{"topic": f"Insights on {i}", "hook": f"Here's what I learned about {i}...", "tone": "professional"} for i in interests[:4]]

    return json.dumps({"status": "success", "suggestions": suggestions})


TOOLS = [draft_linkedin_post, get_post_suggestions]
