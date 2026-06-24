import assert from "node:assert/strict";
import {
  applyReflectionResult,
  routeAfterPlanModification,
  routeAfterReflection,
} from "../src/agents";
import type { AgentRuntimeState } from "../src/runtime/state";
import type { ReflectionResult } from "../src/types/agent";
import { getToolsByName, registerBuiltinTools } from "../src/tools";

/**
 * 这里只验证纯状态转移，不调用真实 LLM。
 * 这样测试稳定、快速，也能精确说明 Agent Loop 的业务规则。
 */
function state(overrides: Partial<AgentRuntimeState> = {}): AgentRuntimeState {
  return {
    messages: [],
    request: "验证 Agent Loop",
    ragMode: false,
    ragStrategy: "search",
    ragContext: "",
    route: "plan",
    plan: {
      goal: "验证 Agent Loop",
      steps: [
        { id: 1, task: "执行第一步" },
        { id: 2, task: "执行第二步" },
      ],
    },
    currentStep: 0,
    executionResults: [],
    lastExecutedStep: 0,
    skillName: null,
    decision: null,
    reflection: null,
    retryCount: 0,
    maxRetries: 2,
    errors: [],
    toolCallCount: 0,
    maxToolCalls: 8,
    ...overrides,
  };
}

function decision(
  status: ReflectionResult["status"],
  feedback = "测试反馈",
): ReflectionResult {
  return { status, reason: `测试 ${status}`, feedback };
}

const passed = applyReflectionResult(state(), decision("pass"));
assert.equal(passed.currentStep, 1, "pass 应推进到下一步");
assert.equal(passed.retryCount, 0, "pass 应清空重试计数");
assert.equal(
  routeAfterReflection({ ...state(), ...passed }),
  "executor",
  "还有剩余步骤时应继续执行",
);

const retried = applyReflectionResult(state(), decision("retry"));
assert.equal(retried.currentStep, 0, "retry 必须停留在当前步骤");
assert.equal(retried.retryCount, 1, "retry 应增加重试计数");
assert.equal(routeAfterReflection({ ...state(), ...retried }), "executor");

const exhausted = applyReflectionResult(
  state({ retryCount: 2 }),
  decision("retry", "仍未满足要求"),
);
assert.equal(exhausted.reflection?.status, "fail", "达到上限后必须停止重试");
assert.equal(routeAfterReflection({ ...state(), ...exhausted }), "reply");

const replanned = applyReflectionResult(state(), decision("replan"));
assert.equal(replanned.currentStep, 0, "replan 不应错误推进步骤");
assert.equal(routeAfterReflection({ ...state(), ...replanned }), "planner");

assert.equal(
  routeAfterPlanModification(state({ plan: null })),
  "planner",
  "只有修改意见时应回到 Planner",
);
assert.equal(
  routeAfterPlanModification(state()),
  "planConfirm",
  "直接提交完整计划时应再次进入 HITL",
);

registerBuiltinTools();
assert.ok(getToolsByName(undefined).length > 0, "未声明工具白名单时应使用全局工具");
assert.equal(getToolsByName([]).length, 0, "空工具白名单必须禁止全部工具");

console.log("Agent Loop 状态转移验证通过");
