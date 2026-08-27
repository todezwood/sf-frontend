import { render, screen } from "@testing-library/react";
import ContactAvatar from "@/components/contacts/ContactAvatar";

const CONTACT = {
  first_name: "Ada",
  last_name: "Lovelace",
  email: "ada@example.com",
  photo: null,
};

describe("ContactAvatar", () => {
  it("renders initials when there is no photo", () => {
    render(<ContactAvatar contact={CONTACT} />);

    expect(screen.getByText("AL")).toBeInTheDocument();
    expect(document.querySelector("img")).not.toBeInTheDocument();
  });

  it("renders the photo as a circular image when present", () => {
    const photo = "data:image/png;base64,iVBORw0KGgo=";
    render(<ContactAvatar contact={{ ...CONTACT, photo }} />);

    const img = document.querySelector("img");
    expect(img).toHaveAttribute("src", photo);
    expect(img).toHaveClass("rounded-full", "object-cover");
    expect(screen.queryByText("AL")).not.toBeInTheDocument();
  });
});
