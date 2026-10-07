import { beforeEach, expect, it, vi } from "vitest";
import { cloneDefaultDocument, STORAGE_KEY } from "./diagram";
import { acknowledgeRecovery, ENVELOPE_STORAGE_KEY, loadDiagramRecovery, saveDiagram } from "./persistence";
beforeEach(()=>localStorage.clear());
it("migrates legacy data without changing the original and retains portable style",()=>{
  const old=JSON.stringify(cloneDefaultDocument());
  localStorage.setItem(STORAGE_KEY,old);
  const document={...loadDiagramRecovery().document,styleProfile:"portable-v1" as const};
  saveDiagram(document);
  expect(localStorage.getItem(STORAGE_KEY)).toBe(old);
  expect(loadDiagramRecovery()).toEqual({document,conflict:false});
});
it.each(["{broken",JSON.stringify({schemaVersion:99})])("preserves unreadable envelope bytes before recovery %#",(raw)=>{
  localStorage.setItem(ENVELOPE_STORAGE_KEY,raw);
  const recovery=loadDiagramRecovery();
  expect(recovery.conflict).toBe(true);
  expect(()=>saveDiagram(recovery.document)).toThrow("recovery");
  expect(localStorage.getItem(ENVELOPE_STORAGE_KEY)).toBe(raw);
  acknowledgeRecovery(recovery.document);
  const keys=Object.keys(localStorage).filter(k=>k.startsWith(ENVELOPE_STORAGE_KEY+":recovery:"));
  expect(keys).toHaveLength(1);
  expect(localStorage.getItem(keys[0])).toBe(raw);
  expect(loadDiagramRecovery().conflict).toBe(false);
});
it("keeps original data when the recovery backup cannot be written",()=>{
  localStorage.setItem(ENVELOPE_STORAGE_KEY,"{broken");
  const set=vi.spyOn(Storage.prototype,"setItem").mockImplementation(()=>{throw Error("quota");});
  expect(()=>acknowledgeRecovery(cloneDefaultDocument())).toThrow("quota");
  set.mockRestore();
  expect(localStorage.getItem(ENVELOPE_STORAGE_KEY)).toBe("{broken");
});
