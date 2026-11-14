import { createBrowserRouter } from "react-router-dom";
import { AppLayout } from "./components/AppLayout";
import { HealthPage } from "./pages/HealthPage";

export const router = createBrowserRouter([
  {
    path: "/",
    element: <AppLayout />,
    children: [
      {
        index: true,
        element: <HealthPage />,
      },
    ],
  },
]);
