"""Hosts that topic links may point to: official docs and long-trusted references only."""

from urllib.parse import urlsplit

ALLOWED_HOSTS: frozenset[str] = frozenset(
    {
        # Languages and runtimes
        "docs.python.org",
        "peps.python.org",
        "wiki.python.org",
        "typescriptlang.org",
        "developer.mozilla.org",
        # Frameworks and libraries
        "docs.djangoproject.com",
        "django-rest-framework.org",
        "docs.celeryq.dev",
        "pytest-django.readthedocs.io",
        "angular.dev",
        "fastapi.tiangolo.com",
        "docs.sqlalchemy.org",
        "learn.microsoft.com",
        # Databases
        "postgresql.org",
        "sqlite.org",
        # Algorithms
        "cp-algorithms.com",
        "algs4.cs.princeton.edu",  # site of Sedgewick & Wayne's Algorithms, 4th ed.
        # Systems and architecture
        "martinfowler.com",
        "sre.google",
        "allthingsdistributed.com",
        "grpc.io",
        "kafka.apache.org",
        "cassandra.apache.org",
        "elastic.co",
        "redis.io",
        "nginx.org",
        "kubernetes.io",
        "developer.hashicorp.com",
        "owasp.org",  # also covers cheatsheetseries.owasp.org
        "aws.amazon.com",
        "opentelemetry.io",
        "jepsen.io",
        "raft.github.io",
        "docs.stripe.com",
        # AI and machine learning
        "docs.anthropic.com",
        "platform.claude.com",  # Anthropic's current docs site
        "anthropic.com",
        "modelcontextprotocol.io",
        "huggingface.co",
        "scikit-learn.org",
        "developers.google.com",
        "arxiv.org",  # original papers
        "genai.owasp.org",
        # Official repositories
        "github.com",
    }
)


def is_allowed(url: str) -> bool:
    """True when the URL's host (without `www.`) is an allowed host or a subdomain of one."""
    host = (urlsplit(url).hostname or "").removeprefix("www.")
    return any(host == h or host.endswith("." + h) for h in ALLOWED_HOSTS)
