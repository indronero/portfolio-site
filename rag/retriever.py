from dotenv import load_dotenv
import os

from langchain_google_genai import ChatGoogleGenerativeAI, GoogleGenerativeAIEmbeddings
from langchain_community.vectorstores import FAISS

from langchain_groq import ChatGroq

from rag.ingest import main as build_index

load_dotenv()


def get_chain():

    index_path = "rag/faiss_index"

    # AUTO-BUILD INDEX IF MISSING
    if not os.path.exists(index_path):
        print("FAISS index not found. Building...")
        build_index()

    embeddings = GoogleGenerativeAIEmbeddings(
        model="models/gemini-embedding-001"
    )

    vector_store = FAISS.load_local(
        index_path,
        embeddings,
        allow_dangerous_deserialization=True
    )

    retriever = vector_store.as_retriever(search_kwargs={"k": 3})

    # ===============================
    # PRIMARY: GEMINI
    # ===============================
    gemini_llm = ChatGoogleGenerativeAI(
        model="gemini-2.5-flash-lite",
        temperature=0.3
    )

    # ===============================
    # FALLBACK: GROQ
    # ===============================
    groq_llm = ChatGroq(
        api_key=os.getenv("GROQ_API_KEY"),
        model="llama-3.1-8b-instant",
        temperature=0.3
    )


    def ask(query):
        docs = retriever.invoke(query)
        context = "\n".join([d.page_content for d in docs])

        prompt = f"""
You are a friendly, knowledgeable AI assistant representing Indroneel Das.

Context:
{context}

Question:
{query}

Answer naturally:
"""

        try:
            response = gemini_llm.invoke(prompt)
            return response.content or "Sorry, I couldn't generate a response."

        except Exception as e:
            print("Gemini failed:", e)

            # fallback only for quota-type issues
            if "RESOURCE_EXHAUSTED" not in str(e) and "429" not in str(e):
                raise e

            try:
                response = groq_llm.invoke(prompt)
                return response.content or "Sorry, I couldn't generate a response."

            except Exception as e2:
                print("Groq also failed:", e2)
                raise e2


    return ask