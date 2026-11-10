import SmileCapture from "../../../components/verification/SmileCapture";
export default async function Page({ searchParams }) {
  const query = (await searchParams) || {};
  return (
    <SmileCapture
      attemptId={typeof query.attempt === "string" ? query.attempt : ""}
    />
  );
}
