import { Button } from '@components/ui/button';
import { Input } from '@components/ui/input';
import { Label } from '@components/ui/label';
import { Textarea } from '@components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@components/ui/select';
import { Plus, Trash2 } from 'lucide-react';
import type { EncounterNoteSections, EncounterPlanItem, EncounterProblemRow } from './encounterConsultTypes';
import { newPlanItemId, newProblemId, PLAN_ITEM_TYPES, PROBLEM_STATUSES } from './encounterVariants';

interface EncounterProblemsSectionProps {
  sections: EncounterNoteSections;
  readOnly: boolean;
  requireIcd: boolean;
  onChange: (problems: EncounterNoteSections['problems']) => void;
  onFocus: () => void;
}

function updateProblem(
  problems: EncounterProblemRow[],
  problemId: string,
  patch: Partial<EncounterProblemRow>,
): EncounterProblemRow[] {
  return problems.map((problem) => (
    problem.id === problemId ? { ...problem, ...patch } : problem
  ));
}

function addPlanItem(problems: EncounterProblemRow[], problemId: string): EncounterProblemRow[] {
  const item: EncounterPlanItem = {
    id: newPlanItemId(),
    type: 'education',
    text: '',
  };

  return problems.map((problem) => (
    problem.id === problemId
      ? { ...problem, plan_items: [...problem.plan_items, item] }
      : problem
  ));
}

function updatePlanItem(
  problems: EncounterProblemRow[],
  problemId: string,
  planItemId: string,
  patch: Partial<EncounterPlanItem>,
): EncounterProblemRow[] {
  return problems.map((problem) => {
    if (problem.id !== problemId) {
      return problem;
    }

    return {
      ...problem,
      plan_items: problem.plan_items.map((item) => (
        item.id === planItemId ? { ...item, ...patch } : item
      )),
    };
  });
}

function removePlanItem(
  problems: EncounterProblemRow[],
  problemId: string,
  planItemId: string,
): EncounterProblemRow[] {
  return problems.map((problem) => (
    problem.id === problemId
      ? { ...problem, plan_items: problem.plan_items.filter((item) => item.id !== planItemId) }
      : problem
  ));
}

export function EncounterProblemsSection({
  sections,
  readOnly,
  requireIcd,
  onChange,
  onFocus,
}: EncounterProblemsSectionProps) {
  const problems = sections.problems.items;

  const setProblems = (items: EncounterProblemRow[]) => {
    onChange({ items });
  };

  return (
    <div className="space-y-4" onFocus={onFocus}>
      {problems.map((problem, index) => (
        <div
          key={problem.id}
          className="rounded-lg border border-[var(--oe-nc-border)] bg-[var(--oe-nc-bg-tint,#f8fafc)] p-4"
        >
          <div className="mb-3 flex items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-[var(--oe-nc-text)]">
              Problem
              {' '}
              {index + 1}
            </h3>
            {!readOnly && problems.length > 1 && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setProblems(problems.filter((row) => row.id !== problem.id))}
              >
                <Trash2 className="h-4 w-4" aria-hidden="true" />
                Remove
              </Button>
            )}
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor={`problem-label-${problem.id}`}>Problem label</Label>
              <Input
                id={`problem-label-${problem.id}`}
                value={problem.problem_label}
                disabled={readOnly}
                onChange={(event) => setProblems(updateProblem(problems, problem.id, {
                  problem_label: event.target.value,
                }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor={`problem-icd-${problem.id}`}>
                ICD-10 code
                {requireIcd ? ' (required)' : ''}
              </Label>
              <Input
                id={`problem-icd-${problem.id}`}
                placeholder="e.g. I10"
                value={problem.icd10_code}
                disabled={readOnly}
                onChange={(event) => setProblems(updateProblem(problems, problem.id, {
                  icd10_code: event.target.value,
                }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor={`problem-icd-label-${problem.id}`}>ICD description</Label>
              <Input
                id={`problem-icd-label-${problem.id}`}
                value={problem.icd10_label}
                disabled={readOnly}
                onChange={(event) => setProblems(updateProblem(problems, problem.id, {
                  icd10_label: event.target.value,
                }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor={`problem-status-${problem.id}`}>Status</Label>
              <Select
                value={problem.status}
                disabled={readOnly}
                onValueChange={(value) => setProblems(updateProblem(problems, problem.id, {
                  status: value as EncounterProblemRow['status'],
                }))}
              >
                <SelectTrigger id={`problem-status-${problem.id}`}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PROBLEM_STATUSES.map((status) => (
                    <SelectItem key={status} value={status}>{status}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="mt-3 space-y-2">
            <Label htmlFor={`problem-assessment-${problem.id}`}>Assessment narrative</Label>
            <Textarea
              id={`problem-assessment-${problem.id}`}
              rows={4}
              value={problem.assessment_narrative}
              disabled={readOnly}
              onChange={(event) => setProblems(updateProblem(problems, problem.id, {
                assessment_narrative: event.target.value,
              }))}
            />
          </div>

          <div className="mt-3 space-y-2">
            <Label htmlFor={`problem-differential-${problem.id}`}>Differential diagnosis</Label>
            <Textarea
              id={`problem-differential-${problem.id}`}
              rows={3}
              value={problem.differential}
              disabled={readOnly}
              onChange={(event) => setProblems(updateProblem(problems, problem.id, {
                differential: event.target.value,
              }))}
            />
          </div>

          <div className="mt-4 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h4 className="text-sm font-medium text-[var(--oe-nc-text)]">Plan items</h4>
              {!readOnly && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setProblems(addPlanItem(problems, problem.id))}
                >
                  <Plus className="h-4 w-4 mr-1" aria-hidden="true" />
                  Add item
                </Button>
              )}
            </div>
            {problem.plan_items.length === 0 && (
              <p className="text-sm text-[var(--oe-nc-text-muted)]">No plan items yet.</p>
            )}
            {problem.plan_items.map((item, planIndex) => (
              <div key={item.id} className="grid gap-2 rounded-md border border-[var(--oe-nc-border)] bg-white p-3 md:grid-cols-[140px_minmax(0,1fr)_auto]">
                <Select
                  value={item.type}
                  disabled={readOnly}
                  onValueChange={(value) => setProblems(updatePlanItem(problems, problem.id, item.id, {
                    type: value as EncounterPlanItem['type'],
                  }))}
                >
                  <SelectTrigger aria-label={`Plan item ${planIndex + 1} type`}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PLAN_ITEM_TYPES.map((type) => (
                      <SelectItem key={type} value={type}>{type}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  placeholder="Plan action / recommendation"
                  value={item.text}
                  disabled={readOnly}
                  onChange={(event) => setProblems(updatePlanItem(problems, problem.id, item.id, {
                    text: event.target.value,
                  }))}
                />
                {!readOnly && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setProblems(removePlanItem(problems, problem.id, item.id))}
                  >
                    <Trash2 className="h-4 w-4" aria-hidden="true" />
                  </Button>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}

      {!readOnly && (
        <Button
          type="button"
          variant="outline"
          onClick={() => setProblems([
            ...problems,
            {
              id: newProblemId(),
              problem_label: '',
              icd10_code: '',
              icd10_label: '',
              status: 'new',
              assessment_narrative: '',
              differential: '',
              plan_items: [],
            },
          ])}
        >
          <Plus className="h-4 w-4 mr-1" aria-hidden="true" />
          Add problem
        </Button>
      )}
    </div>
  );
}
