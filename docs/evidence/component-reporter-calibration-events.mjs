export default async function* report(events) {
 for await (const event of events) if(event.type === 'test:fail') {
  const d=event.data?.details; const e=d?.error;
  yield JSON.stringify({testNumber:event.data.testNumber,durationMs:d?.duration_ms,code:e?.code,failureType:e?.failureType,causeCode:e?.cause?.code,causeFailureType:e?.cause?.failureType})+'\n';
 }
}
