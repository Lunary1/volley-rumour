---
name: Fix auth pages scrolling with Header Footer
overview: Fix the scrolling issue on auth pages while keeping Header and Footer by changing the auth pages from using h-screen (100vh) to h-full, allowing them to fit within the available space in the main container.
todos:
  - id: fix-login-page
    content: Change h-screen to h-full in app/auth/login/page.tsx
    status: pending
  - id: fix-signup-page
    content: Change h-screen to h-full in app/auth/sign-up/page.tsx (both success and form states)
    status: pending
isProject: false
---

## Problem Analysis

The auth pages (`app/auth/login/page.tsx` and `app/auth/sign-up/page.tsx`) use `h-screen` (100vh) to fill the viewport, but they're nested inside the root layout structure:

```
<body min-h-screen flex flex-col>
  <Header />
  <main flex-1>
    <div h-screen>  <!-- Auth page content - PROBLEM HERE -->
```

The `h-screen` class forces the auth page container to be exactly 100vh tall, but it's inside a `<main>` element that's inside a flex column with Header and Footer. This causes the total height to exceed 100vh, resulting in unwanted scrolling.

## Solution

Instead of using `h-screen` (100vh), the auth pages should use `h-full` to fill the available space within the `<main>` container. The `<main>` element already has `flex-1`, which means it will take up the remaining space after Header and Footer, so `h-full` on the auth pages will make them fill that available space without causing overflow.

## Implementation

1. **Update `app/auth/login/page.tsx`**

   - Change the outer container div from `h-screen` to `h-full`
   - Keep `overflow-hidden` to prevent any internal scrolling
   - The container will now respect the parent `<main>` height instead of forcing 100vh

2. **Update `app/auth/sign-up/page.tsx`**

   - Change both outer container divs (the success state and the form state) from `h-screen` to `h-full`
   - Keep `overflow-hidden` to prevent any internal scrolling
   - Both states will now fit within the available space

## Files to Modify

- **Modify**: `app/auth/login/page.tsx` - Change `h-screen` to `h-full` on line 48
- **Modify**: `app/auth/sign-up/page.tsx` - Change `h-screen` to `h-full` on lines 58 and 87

The root layout (`app/layout.tsx`) doesn't need changes - the `flex-1` class on `<main>` already ensures it takes the remaining space after Header and Footer.