import { render, screen } from "@testing-library/react";
import App from "@/App";

test("menampilkan judul MabaKit", () => {
  render(<App />);
  expect(screen.getByRole("heading", { name: "MabaKit" })).toBeInTheDocument();
});
