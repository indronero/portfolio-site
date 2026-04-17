import yaml
import os
from dotenv import load_dotenv

from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_core.documents import Document
from langchain_google_genai import GoogleGenerativeAIEmbeddings
from langchain_community.vectorstores import FAISS

load_dotenv()


def load_yaml(file_path):
    with open(file_path, "r") as f:
        return yaml.safe_load(f)


def flatten_yaml(data, parent_key=""):
    text = ""

    if isinstance(data, dict):
        for k, v in data.items():
            text += flatten_yaml(v, f"{parent_key} {k}")
    elif isinstance(data, list):
        for item in data:
            text += flatten_yaml(item, parent_key)
    else:
        text += f"{parent_key}: {data}\n"

    return text


def main():
    index_path = "rag/faiss_index"

    data = load_yaml("rag/resume_master.yaml")
    text = flatten_yaml(data)

    splitter = RecursiveCharacterTextSplitter(
        chunk_size=500,
        chunk_overlap=50
    )

    docs = splitter.create_documents([text])

    embeddings = GoogleGenerativeAIEmbeddings(
        model="models/gemini-embedding-001"
    )

    vector_store = FAISS.from_documents(docs, embeddings)

    # Ensure directory exists 
    os.makedirs(index_path, exist_ok=True)

    vector_store.save_local(index_path)

    print("✅ FAISS index created successfully!")


if __name__ == "__main__":
    main()