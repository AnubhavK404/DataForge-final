import { Suspense } from "react";
import SignInPage from "./SignInPage";

export default function Page() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <SignInPage />
    </Suspense>
  );
}