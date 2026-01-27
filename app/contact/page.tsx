"use client";

import { useState } from "react";
import { Metadata } from "next";
import { submitContactForm } from "@/app/actions/contact";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export default function ContactPage() {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    category: "feedback" as "feedback" | "report" | "partnership" | "other",
    message: "",
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState<
    | { type: "success"; message: string }
    | { type: "error"; message: string }
    | null
  >(null);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleCategoryChange = (value: string) => {
    setFormData((prev) => ({
      ...prev,
      category: value as "feedback" | "report" | "partnership" | "other",
    }));
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSubmitting(true);
    setSubmitStatus(null);

    try {
      const result = await submitContactForm(formData);

      if (result.success) {
        setSubmitStatus({
          type: "success",
          message:
            "Bedankt voor je bericht! We nemen spoedig contact met je op.",
        });
        setFormData({
          name: "",
          email: "",
          category: "feedback",
          message: "",
        });
      } else {
        setSubmitStatus({
          type: "error",
          message: result.error || "Er is een fout opgetreden.",
        });
      }
    } catch (error) {
      setSubmitStatus({
        type: "error",
        message: "Er is een fout opgetreden. Probeer later opnieuw.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <section className="border-b border-border">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-12 lg:py-20">
          <h1 className="text-4xl font-bold mb-4 text-foreground">
            Contacteer Ons
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl">
            Heb je feedback, wil je iets rapporteren, of wil je samenwerken?
            Neem contact met ons op. We beantwoorden je bericht graag.
          </p>
        </div>
      </section>

      {/* Content Section */}
      <section className="mx-auto max-w-2xl px-4 sm:px-6 lg:px-8 py-12">
        <form onSubmit={handleSubmit} className="space-y-8">
          {/* Name */}
          <div className="space-y-2">
            <Label htmlFor="name" className="text-foreground font-semibold">
              Naam *
            </Label>
            <Input
              id="name"
              name="name"
              type="text"
              value={formData.name}
              onChange={handleChange}
              placeholder="Voer je naam in"
              required
              minLength={2}
              className="bg-input border-border text-foreground"
            />
            <p className="text-xs text-muted-foreground">
              Minimaal 2 karakters
            </p>
          </div>

          {/* Email */}
          <div className="space-y-2">
            <Label htmlFor="email" className="text-foreground font-semibold">
              E-mailadres *
            </Label>
            <Input
              id="email"
              name="email"
              type="email"
              value={formData.email}
              onChange={handleChange}
              placeholder="jouw@voorbeeld.be"
              required
              className="bg-input border-border text-foreground"
            />
            <p className="text-xs text-muted-foreground">
              We contacteren je via dit adres
            </p>
          </div>

          {/* Category */}
          <div className="space-y-2">
            <Label htmlFor="category" className="text-foreground font-semibold">
              Onderwerp *
            </Label>
            <Select
              value={formData.category}
              onValueChange={handleCategoryChange}
            >
              <SelectTrigger
                id="category"
                className="bg-input border-border text-foreground"
              >
                <SelectValue placeholder="Kies een onderwerp" />
              </SelectTrigger>
              <SelectContent className="bg-card border-border">
                <SelectItem value="feedback">Feedback/Suggestie</SelectItem>
                <SelectItem value="report">Rapporteer Misbruik</SelectItem>
                <SelectItem value="partnership">Samenwerking</SelectItem>
                <SelectItem value="other">Overig</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Message */}
          <div className="space-y-2">
            <Label htmlFor="message" className="text-foreground font-semibold">
              Bericht *
            </Label>
            <Textarea
              id="message"
              name="message"
              value={formData.message}
              onChange={handleChange}
              placeholder="Voer je bericht hier in..."
              required
              minLength={10}
              rows={6}
              className="bg-input border-border text-foreground resize-none"
            />
            <p className="text-xs text-muted-foreground">
              Minimaal 10 karakters
            </p>
          </div>

          {/* Submit Status Messages */}
          {submitStatus && (
            <div
              className={`p-4 rounded-lg border ${
                submitStatus.type === "success"
                  ? "bg-green-500/10 border-green-500/30 text-green-700"
                  : "bg-destructive/10 border-destructive/30 text-destructive"
              }`}
            >
              {submitStatus.message}
            </div>
          )}

          {/* Submit Button */}
          <div className="flex gap-3">
            <Button
              type="submit"
              disabled={isSubmitting}
              className="bg-primary text-primary-foreground hover:bg-primary/90"
            >
              {isSubmitting ? "Verzenden..." : "Verzend Bericht"}
            </Button>
            <Button
              type="reset"
              variant="outline"
              className="bg-transparent border-border text-foreground hover:bg-muted"
              onClick={() =>
                setFormData({
                  name: "",
                  email: "",
                  category: "feedback",
                  message: "",
                })
              }
            >
              Wissen
            </Button>
          </div>

          {/* Help Text */}
          <div className="bg-card border border-border rounded-lg p-6 space-y-3">
            <h3 className="font-semibold text-foreground">
              Wat kan ik hier voor melden?
            </h3>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>
                <strong>Feedback/Suggestie:</strong> Je ideeën voor nieuwe
                functies of verbeteringen
              </li>
              <li>
                <strong>Rapporteer Misbruik:</strong> Spam, bedreigingen, of
                schending van regels
              </li>
              <li>
                <strong>Samenwerking:</strong> Partnership, sponsoring, of
                mediaverzoeken
              </li>
              <li>
                <strong>Overig:</strong> Iets anders waardoor je contact wilt
                opnemen
              </li>
            </ul>
          </div>
        </form>
      </section>
    </div>
  );
}
