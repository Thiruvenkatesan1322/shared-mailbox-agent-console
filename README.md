# Shared Mailbox Agent Operations Console

A Django-powered frontend simulation of an autonomous shared mailbox support workflow. The console makes the complete incident lifecycle visible, from ServiceNow intake and LLM classification through approval gates, Exchange Online remediation, replication monitoring, user validation, and ticket closure or escalation.

## Demonstrated workflows

- **Shared Mailbox Delegation Request**: owner approval, permission assignment, propagation, verification, and closure.
- **Shared Mailbox Access Issue**: configuration diagnosis, OWA validation, Auto-Mapping checks, permission reapplication, propagation, and final user confirmation.

The integrations are simulated in the browser. No ServiceNow, Microsoft 365, Entra ID, Exchange Online, or MCP credentials are required.

## Run locally

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
python manage.py migrate
python manage.py runserver
```

Open `http://127.0.0.1:8000/`.

## Validate

```powershell
python manage.py check
python manage.py test
```