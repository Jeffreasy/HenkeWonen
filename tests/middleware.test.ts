import { describe, it, expect, vi, beforeEach } from "vitest";

// Use vi.hoisted to initialize mocks before vi.mock hoisting
const mocks = vi.hoisted(() => ({
  mockGetSession: vi.fn(),
  mockCreateSessionAuthzToken: vi.fn(),
  mockRefreshLaventeCareSession: vi.fn(),
  mockSyncSessionToConvex: vi.fn()
}));

// Mock virtual and imported modules
vi.mock("astro:middleware", () => ({
  defineMiddleware: (fn: any) => fn
}));

vi.mock("../src/lib/auth", () => ({
  authProvider: {
    getSession: mocks.mockGetSession
  }
}));

vi.mock("../src/lib/auth/authzToken", () => ({
  createSessionAuthzToken: mocks.mockCreateSessionAuthzToken
}));

vi.mock("../src/lib/auth/laventeCareAuthProvider", () => ({
  refreshLaventeCareSession: mocks.mockRefreshLaventeCareSession
}));

vi.mock("../src/lib/auth/sessionSync", () => ({
  syncSessionToConvex: mocks.mockSyncSessionToConvex
}));

// Import middleware under test
import { onRequest } from "../src/middleware";

describe("Astro Authentication and Routing Middleware", () => {
  let mockContext: any;
  let mockNext: any;

  beforeEach(() => {
    vi.clearAllMocks();

    mockNext = vi.fn().mockResolvedValue(new Response("success"));
    mockContext = {
      request: {
        url: "http://localhost:4321/portal"
      },
      cookies: {},
      locals: {},
      redirect: vi.fn((path) => new Response(`Redirecting to ${path}`, { status: 302 }))
    };

    mocks.mockCreateSessionAuthzToken.mockResolvedValue("mocked-authz-token");
    mocks.mockSyncSessionToConvex.mockResolvedValue(undefined);
  });

  it("should redirect to /login if user is not authenticated on a protected portal route", async () => {
    mockContext.request.url = "http://localhost:4321/portal/dashboard";
    mocks.mockGetSession.mockResolvedValue(null);
    mocks.mockRefreshLaventeCareSession.mockResolvedValue(null);

    const response = await onRequest(mockContext, mockNext);
    
    expect(mockContext.redirect).toHaveBeenCalledWith("/login");
    expect(response).toBeInstanceOf(Response);
    expect((response as Response).status).toBe(302);
    expect(mockNext).not.toHaveBeenCalled();
  });

  it("should proceed (call next) without session if requesting an unprotected route (like /login)", async () => {
    mockContext.request.url = "http://localhost:4321/login";
    mocks.mockGetSession.mockResolvedValue(null);

    await onRequest(mockContext, mockNext);
    
    expect(mockContext.redirect).not.toHaveBeenCalled();
    expect(mockNext).toHaveBeenCalled();
    expect(mockContext.locals.session).toBeNull();
  });

  it("should populate session, call syncSessionToConvex, and proceed if user is authenticated", async () => {
    const rawSession = {
      userId: "user-1",
      email: "user@test.com",
      workspaceMode: "office"
    };
    mocks.mockGetSession.mockResolvedValue(rawSession);
    mockContext.request.url = "http://localhost:4321/portal/dashboard";

    await onRequest(mockContext, mockNext);

    expect(mockContext.locals.session).toEqual({
      ...rawSession,
      authzToken: "mocked-authz-token"
    });
    expect(mocks.mockSyncSessionToConvex).toHaveBeenCalledWith(mockContext.locals.session);
    expect(mockNext).toHaveBeenCalled();
    expect(mockContext.redirect).not.toHaveBeenCalled();
  });

  it("should redirect to buitendienst/vandaag if a field agent accesses /portal without full parameter", async () => {
    const rawSession = {
      userId: "field-agent-1",
      email: "field@test.com",
      workspaceMode: "field"
    };
    mocks.mockGetSession.mockResolvedValue(rawSession);
    mockContext.request.url = "http://localhost:4321/portal";

    await onRequest(mockContext, mockNext);

    expect(mockContext.redirect).toHaveBeenCalledWith("/portal/buitendienst/vandaag");
    expect(mockNext).not.toHaveBeenCalled();
  });

  it("should allow a field agent to access /portal if ?full=1 is set", async () => {
    const rawSession = {
      userId: "field-agent-1",
      email: "field@test.com",
      workspaceMode: "field"
    };
    mocks.mockGetSession.mockResolvedValue(rawSession);
    mockContext.request.url = "http://localhost:4321/portal?full=1";

    await onRequest(mockContext, mockNext);

    expect(mockContext.redirect).not.toHaveBeenCalled();
    expect(mockNext).toHaveBeenCalled();
  });
});
