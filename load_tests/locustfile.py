"""Authenticated Atlas read-workload smoke test.

Run only against an Atlas instance you own:
ATLAS_TEST_EMAIL=... ATLAS_TEST_PASSWORD=... ATLAS_TEST_WORKSPACE_ID=... \
  locust -f load_tests/locustfile.py --host http://127.0.0.1:8000

Each virtual user logs in with the configured test account. For realistic
multi-tenant behavior, use distinct accounts/workspaces in your staging harness.
"""
import os
from locust import HttpUser, between, task


class AtlasUser(HttpUser):
    wait_time = between(1, 3)

    def on_start(self):
        email = os.environ["ATLAS_TEST_EMAIL"]
        password = os.environ["ATLAS_TEST_PASSWORD"]
        self.workspace = os.environ["ATLAS_TEST_WORKSPACE_ID"]
        with self.client.post("/api/auth/login", json={"email": email, "password": password},
                              name="login", catch_response=True) as response:
            if response.status_code != 200:
                response.failure(f"Authentication failed: HTTP {response.status_code}")
                raise RuntimeError("Atlas load test requires a working test account")

    @task(4)
    def documents(self):
        self.client.get(f"/api/workspaces/{self.workspace}/documents", name="documents")

    @task(2)
    def workspaces(self):
        self.client.get("/api/workspaces", name="workspaces")

    @task
    def operations(self):
        self.client.get(f"/api/workspaces/{self.workspace}/operations", name="operations")
