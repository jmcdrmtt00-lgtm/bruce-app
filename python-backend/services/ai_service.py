import os
import anthropic

client = anthropic.Anthropic(api_key=os.environ.get("ANTHROPIC_API_KEY"))


async def ask(prompt: str, system: str = "") -> str:
    """Send a prompt to Claude and return the response text."""
    message = client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=1024,
        system=system or "You are a helpful IT assistant for Oriol Healthcare.",
        messages=[{"role": "user", "content": prompt}],
    )
    return message.content[0].text


async def summarize_incident(description: str) -> str:
    """Generate a short title for an IT incident from its description."""
    message = client.messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=30,
        system="Generate a very short title (5-8 words) for this IT problem. Return only the title, nothing else.",
        messages=[{"role": "user", "content": description}],
    )
    return message.content[0].text.strip()
