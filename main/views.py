from django.shortcuts import render
from django.views.decorators.csrf import ensure_csrf_cookie
from django.http import JsonResponse
from django.views.decorators.http import require_POST
from django_ratelimit.decorators import ratelimit

import json

from rag.retriever import get_chain


qa_chain = get_chain()


@ensure_csrf_cookie
def home(request):
    path = request.path.strip("/")

    tab_map = {
        "": "home",
        "projects": "projects",
        "experience": "experience",
        "skills": "skills",
        "education": "education",
        "ai": "ai",
    }

    active_tab = tab_map.get(path, "home")

    return render(request, "main/index.html", {
        "active_tab": active_tab
    })


@require_POST
@ratelimit(key='ip', rate='8/m', block=True)   # 8 messages per minute per IP 
def chat(request):
    try:
        data = json.loads(request.body)
        query = data.get("message", "").strip()

        if not query:
            return JsonResponse({"response": "Message cannot be empty."}, status=400)
        if len(query) > 500:
            return JsonResponse({"response": "Message is too long."}, status=400)

        # Get chat history from session
        history = request.session.get('chat_history', [])

        # AI call 
        answer = qa_chain(query)

        # Append to history
        history.append({"text": query, "type": "user"})
        history.append({"text": answer, "type": "bot"})

        # Keep only last 20 messages
        if len(history) > 40:
            history = history[-40:]

        request.session['chat_history'] = history
        request.session.modified = True

        return JsonResponse({"response": answer})

    except Exception as e:
        print("CHAT ERROR:", e)

        # If API is exhausted
        if "RESOURCE_EXHAUSTED" in str(e):
            return JsonResponse({
                "response": "AI is currently at capacity. Please try again later."
            }, status=200)

        return JsonResponse({
            "response": "Something went wrong. Please try again later."
        }, status=500)


def chat_history(request):
    """Return chat history from session for initial page load"""
    history = request.session.get('chat_history', [])
    return JsonResponse({"history": history})

@require_POST
def clear_chat(request):
    """Clear chat history for current user"""
    if 'chat_history' in request.session:
        del request.session['chat_history']
    return JsonResponse({"status": "cleared"})