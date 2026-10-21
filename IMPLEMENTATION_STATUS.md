# Implementation status — standalone version 2

The standalone implementation is complete. See [verification and deployment status](docs/VERIFICATION.md) for test results and operational limits.

Implemented: PostgreSQL job/resume storage, independent authentication, manager approval and read-only application inspection, cascading user deletion, browser folder exports, account preferences, renamed UI, and preserved manual application workflow.

Verified: production/TypeScript build, 13 unit tests, 58 real PostgreSQL API checks, manager/password CLI checks, and Edge desktop/mobile browser checks. Production dependency audit reports zero vulnerabilities.

This source is prepared for a Windows 11 VPS. Actual VPS/DNS/HTTPS setup, production credentials/manager account, backups and old-site retirement have not been performed. No prototype data was migrated.

Start with [README.md](README.md) and [WINDOWS_VPS_SETUP.md](WINDOWS_VPS_SETUP.md).
