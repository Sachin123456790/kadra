import { BrowserRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "@/components/angainor/ThemeProvider";
import { ControlRoom } from "./ControlRoom";
import "./control-room.css";
const client = new QueryClient({
  defaultOptions: {
    queries: { retry: false, refetchOnWindowFocus: false },
    mutations: { retry: false },
  },
});
export default function SandboxApp() {
  return (
    <QueryClientProvider client={client}>
      <ThemeProvider defaultTheme="light">
        <BrowserRouter>
          <ControlRoom />
        </BrowserRouter>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
