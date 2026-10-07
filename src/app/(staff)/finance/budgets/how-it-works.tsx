/** The guide for the Budgets page, adapted for ARK OS. */
export function HowItWorks({ isAdmin }: { isAdmin: boolean }) {
  return (
    <details className="bp-help" open={false}>
      <summary>How it works</summary>
      <div className="cols">
        <div>
          <h4>Two kinds of budget</h4>
          <ul>
            <li>
              <b>Monthly</b>: money sits in your sector’s own account. You log what you
              spent, with the receipt. These are records of spending already done.
            </li>
            <li>
              <b>Project</b>: you request a payment to a provider, with their bank
              account and a due date or milestone. An admin pays it and uploads the
              payment receipt.
            </li>
            <li>Salaries are left out of sector spending.</li>
          </ul>
        </div>
        <div>
          <h4>Sector managers</h4>
          <ol>
            <li>Create a budget and add lines (a category and a planned amount).</li>
            <li>Send it for approval. Only drafts can be edited.</li>
            <li>Once it’s approved, log expenses (Monthly) or request payments (Project).</li>
            <li>Track spent and remaining on each line. You’ll see a warning if something goes over, but it still saves.</li>
            <li>See what’s been paid under Payables.</li>
          </ol>
        </div>
        <div>
          <h4>Admins{isAdmin ? "" : " (JP and Mica)"}</h4>
          <ol>
            <li>Approve or reject budgets under Approvals, with a comment.</li>
            <li>Mark payment requests paid and upload the receipt.</li>
            <li>See every sector, filter by sector, and read the history of each budget.</li>
          </ol>
        </div>
      </div>
    </details>
  );
}
