export const healthRoutes = async (app) => {
    app.get("/health", async () => ({
        status: "ok",
        service: "api",
        timestamp: new Date().toISOString(),
    }));
};
// improvement #15
// improvement #21
// improvement #22
// improvement #25
// improvement #30
