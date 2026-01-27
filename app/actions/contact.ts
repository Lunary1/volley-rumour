"use server";

export interface ContactFormData {
  name: string;
  email: string;
  category: "feedback" | "report" | "partnership" | "other";
  message: string;
}

export interface ContactFormResponse {
  success?: boolean;
  error?: string;
}

export async function submitContactForm(
  data: ContactFormData,
): Promise<ContactFormResponse> {
  const { name, email, category, message } = data;

  // Validate input
  if (!name || !email || !message) {
    return { error: "Alle velden zijn vereist." };
  }

  if (name.length < 2) {
    return { error: "Naam moet minimaal 2 karakters lang zijn." };
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { error: "Voer een geldig e-mailadres in." };
  }

  if (message.length < 10) {
    return { error: "Bericht moet minimaal 10 karakters lang zijn." };
  }

  try {
    // Email sending would be implemented here
    // For now, log the contact form submission
    console.log("Contact form submission:", {
      name,
      email,
      category,
      message,
      timestamp: new Date().toISOString(),
    });

    // TODO: Integrate email service (Resend, SendGrid, etc.)
    // Example with Resend:
    // const response = await resend.emails.send({
    //   from: "noreply@volleyrumours.be",
    //   to: "contact@volleyrumours.be",
    //   replyTo: email,
    //   subject: `Nieuw contactformulier: ${category}`,
    //   html: `
    //     <h2>Nieuw bericht van ${name}</h2>
    //     <p><strong>E-mail:</strong> ${email}</p>
    //     <p><strong>Categorie:</strong> ${category}</p>
    //     <p><strong>Bericht:</strong></p>
    //     <p>${message.replace(/\n/g, "<br>")}</p>
    //   `,
    // });

    return {
      success: true,
    };
  } catch (error) {
    console.error("Error submitting contact form:", error);
    return {
      error: "Er is een fout opgetreden. Probeer later alstublieft opnieuw.",
    };
  }
}
