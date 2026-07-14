# Feature SDK

A feature is a build-time module with a validated manifest and one `register` function. It may contribute deterministic calculations, API route descriptors, MCP descriptors, and dashboard descriptors only after the host validates its requested permissions and API compatibility.

Features must use the supplied registration context. They must not access the database, filesystem, or server internals directly.
