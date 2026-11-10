# Privacy Principles & Personal Data Controls

> **DON (Digital Operations Navigator) Privacy Framework**

DON is designed to be a personal operations navigator that operates on the user's behalf without treating user data as telemetry or training material. Privacy is enforced through cryptographic guarantees, user-controlled memory, transparent attribution, and zero-retention defaults.

---

## 1. Core Privacy Tenets

1. **Explicit Storage Rationales**: DON never silently stores user notes, preferences, or conversation memories. Every memory entry includes an explicit `reasonForStorage` visible in the Privacy Center.
2. **Transparent Memory Attribution**: When DON uses a stored memory to answer a question or personalize a response, it explicitly discloses in the AI response:
   - Memory Key
   - Reason Why Memory Was Used (`reasonUsed`)
3. **Encrypted Personal Knowledge**: Long-term personal memories are flagged `isEncrypted = true` and segregated per user identifier.
4. **Zero-Retention Ephemeral Media**: Screen captures, shared screenshots, and meeting audio buffers are transient by default. Raw buffers are purged immediately following analysis unless the owner explicitly chooses to save them as a document.

---

## 2. Personal Knowledge & Memory Controls

The Privacy Center (`/api/privacy`) gives the authenticated owner complete sovereign control over all retained data:

- **Memory Review**: Inspect all stored memory records categorized by `PREFERENCE`, `ROUTINE`, `PROJECT`, `CREDENTIAL_HINT`, and `FACT`.
- **Memory Editing**: Update, rename, or revise the content of any stored memory item.
- **Selective Memory Deletion**: Permanently delete specific memory entries without affecting other knowledge base items.
- **Document Knowledge Base Management**: Remove uploaded documents, which instantly drops their indexed semantic chunks from vector and lexical retrieval pools.

---

## 3. Semantic Document RAG & Citation Transparency

When answering questions from connected documents (`PDF`, `DOCX`, `TXT`, `Markdown`), DON never invents facts or hallucinates sources. Every synthesized response includes structured citations:

```json
{
  "documentId": "doc-security-01",
  "documentName": "Security_Protocols.pdf",
  "pageOrSection": "Section 2",
  "retrievalConfidence": 0.88,
  "snippet": "In the event of an anomaly, the operator must trigger the Emergency Kill Switch..."
}
```

If lexical or semantic similarity fails to meet the minimum confidence threshold, DON explicitly responds:
> *"I could not locate an authoritative answer to this query in your connected documents."*

---

## 4. GDPR / CCPA Compliance Endpoints

DON implements full data portability and the "Right to be Forgotten" via automated endpoints:

### Full Data Export (`GET /api/privacy/export`)
Produces a complete, structured JSON export of all records associated with the user account:
- User profile & credentials metadata (excluding raw password hashes)
- Tasks, projects, goals, and routines
- Encrypted memories and storage rationales
- Connected document metadata and text
- Paired companion devices and allowlisted desktop apps
- Automation recipes and trigger configurations
- Complete audit trail of all tool proposals, approvals, denials, and executions

### Account & Data Erasure (`POST /api/privacy/delete-account`)
Requires explicit confirmation payload `{ "confirmDeletion": true }`.
- Purges all database rows and in-memory caches linked to the user account.
- Revokes all active refresh tokens and active companion device sessions.
- Invalidates paired desktop and Android companion tokens immediately.

---

## 5. Companion Device Session Revocation

Paired companions (Windows Desktop Agent, Android Companion, Browser Extension) can be individually revoked in the dashboard at any time. Revoking a device:
- Sets device status to `REVOKED`.
- Drops active WebSocket relay connections.
- Prevents any further approval requests or intent dispatches to that device ID.
