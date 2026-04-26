# Sophia — Google Drive Process

How Sophia pulls meeting documents from Google Drive and seeds them into the Meeting Intelligence database.

## Prerequisites

```bash
pip install google-auth google-auth-httplib2 google-api-python-client
```

Service account key at: `~/.hermes/credentials/google-drive-service-account.json`

---

## Auth + Service Setup

```python
from google.oauth2 import service_account
from googleapiclient.discovery import build

SERVICE_ACCOUNT_PATH = "~/.hermes/credentials/google-drive-service-account.json"
SCOPES = [
    "https://www.googleapis.com/auth/drive.readonly",
    "https://www.googleapis.com/auth/documents.readonly",
]

def build_drive_service():
    creds = service_account.Credentials.from_service_account_file(
        SERVICE_ACCOUNT_PATH, scopes=SCOPES
    )
    return build("drive", "v3", credentials=creds)
```

---

## Export a Google Doc as Plain Text

```python
def export_doc_as_text(drive_svc, file_id: str) -> str:
    """Export a Google Doc as plain text."""
    try:
        res = drive_svc.files().export(
            fileId=file_id, mimeType="text/plain"
        ).execute()
        if isinstance(res, bytes):
            return res.decode("utf-8", errors="replace")
        return str(res)
    except Exception as e:
        print(f"  ⚠ Failed to export {file_id}: {e}")
        return ""
```

---

## List All Files in a Drive Folder

```python
def list_folder_files(drive_svc, folder_id: str) -> list[dict]:
    """Paginate and return all files in a Drive folder."""
    all_files = []
    page_token = None
    while True:
        results = drive_svc.files().list(
            q=f"'{folder_id}' in parents",
            pageSize=100,
            fields="nextPageToken, files(id, name)",
            pageToken=page_token
        ).execute()
        all_files.extend(results.get("files", []))
        page_token = results.get("nextPageToken")
        if not page_token:
            break
    return all_files
```

---

## Usage

```python
drive_svc = build_drive_service()

# Export a specific doc by file ID
text = export_doc_as_text(drive_svc, "YOUR_GDRIVE_FILE_ID")

# Or list all docs in a folder
files = list_folder_files(drive_svc, "YOUR_FOLDER_ID")
for f in files:
    text = export_doc_as_text(drive_svc, f["id"])
```

---

## Current Meeting Docs

Hardcoded in `/tmp/seed_real.py` — each entry has a `file_id`, `date`, and `title`:

| Date | Title | File ID |
|------|-------|---------|
| 2026-04-24 | Conversely AI | `1VdPTw7_dKX_ELQ6l_v3Mds7qDzu-b4R3Sad7sijleJA` |
| 2026-04-24 | True Choice Morning Huddle | `10TNKqu1VKMvJY7KYScAq3Y4qQqhbWDf6KLb4faza7tY` |
| 2026-04-24 | Daily Pipeline | `1-N3vV1NdtYMG9_SHc4QrwaFkg31luvyG9dQpQwsQf34` |
| 2026-04-23 | True Choice | `1V3auJhfg1A9KHPJCuPSjAXtYr3zVqKKd7Jje5SJt4kk` |
| 2026-04-22 | Daily Pipeline | `147d15w4yl9bVhvCM1zVBbe_oGNcqLpAlPq9OolO8Z0Y` |
| 2026-04-21 | Daily Pipeline | `1sLvPWAy4GBsnhspPWezvCZDZakq9pXX0GVKjmsI6yMU` |
| 2026-04-20 | Finance Weekly | `1XjA32UKuXcdyS2eeDs_aQLJi8-6khfK0QLxUOSoqzkY` |
| 2026-04-20 | True Choice | `1jLRoRM2B44v336NYszKUdXh4O7trH_0IxXs2rR0jm-M` |
| 2026-04-17 | Daily Pipeline | `1Vl4P-SyjfgZV98uXMqNdCu7I8fnzM6IROJkYn1wEfhw` |
| 2026-04-16 | Next Gen Dashboard | `1Vg3d7tgRot9Mdx0Lle9uSkBCJwwDmNUuT5IQUaENhCE` |
| 2026-04-16 | Daily Pipeline | `1PzwWXBDnVRSXLlXD-OsWbV5t65ReFsFWp0kr0rOsG-A` |
| 2026-04-15 | Finance Weekly | `1oLwSLR-nplr2BkEyyLTD29Qc_XRb1YKsYrSl-ueHCBk` |
| 2026-04-15 | Ethan Conversely | `1MwUEm_iIoutdFJj6ynJ2icTB1gza6QSPSvZPQ6A3BFA` |
| 2026-04-15 | Daily Pipeline | `1b4blRfagTgcC023FPdfcR85ZJSnTsIVmnjTYq2dfjFE` |
| 2026-04-14 | Daily Pipeline | `1KqN_Bu2RwSQZVVPGRzoSd1UX1q--pF3OAJCnUJcXi4U` |
| 2026-04-13 | Daily Pipeline | `1qOefYMIXiWI9m8EpXwG1VuoWx8wGPPqJ0ctlEWL76Ns` |

---

## Pitfalls

- **Service account JWT errors** — if you get `invalid_grant: Invalid JWT Signature`, the key is expired. Generate a new one from Google Cloud Console.
- **Slash in filenames** — Google Doc names like `Peter/Severin` will fail when writing to disk. Always replace `/` with `-` before using as a filename.
- **Supabase hostname** — only resolves from Vercel or Peter's Mac. Run seed scripts locally, not from the agent machine.
- **Action item cap** — raw docs can have 50+ items. Cap at 15 per meeting to avoid noise.

---

## Full Seed Script

Located at `/tmp/seed_real.py` on Peter's Mac.
