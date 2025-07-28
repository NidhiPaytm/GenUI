import {
  CustomQuickAction,
  Reflections,
  ContextDocument,
} from "@opencanvas/shared/types";
import { useState } from "react";
import { useToast } from "./use-toast";
import { Item } from "@langchain/langgraph";
import { CONTEXT_DOCUMENTS_NAMESPACE } from "@opencanvas/shared/constants";

export function useStore() {
  const { toast } = useToast();
  const [isLoadingReflections, setIsLoadingReflections] = useState(false);
  const [isLoadingQuickActions, setIsLoadingQuickActions] = useState(false);
  const [reflections, setReflections] = useState<
    Reflections & { assistantId: string; updatedAt: Date }
  >();

  const getReflections = async (assistantId: string): Promise<void> => {
    setIsLoadingReflections(true);
    const res = await fetch("/api/store/get", {
      method: "POST",
      body: JSON.stringify({
        namespace: ["memories", assistantId],
        key: "reflection",
      }),
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (!res.ok) {
      return;
    }

    const { item } = await res.json();

    if (!item?.value) {
      setIsLoadingReflections(false);
      // No reflections found. Return early.
      setReflections(undefined);
      return;
    }

    let styleRules = item.value.styleRules ?? [];
    let content = item.value.content ?? [];
    try {
      styleRules =
        typeof styleRules === "string" ? JSON.parse(styleRules) : styleRules;
      content = typeof content === "string" ? JSON.parse(content) : content;
    } catch (e) {
      console.error("Failed to parse reflections", e);
      styleRules = [];
      content = [];
    }

    setReflections({
      ...item.value,
      styleRules,
      content,
      updatedAt: new Date(item.updatedAt),
      assistantId,
    });
    setIsLoadingReflections(false);
  };

  const addReflections = async (
    assistantId: string,
    newStyleRules: string[],
    newContent: string[]
  ): Promise<void> => {
    setIsLoadingReflections(true);
    try {
      // First get existing reflections
      const getRes = await fetch("/api/store/get", {
        method: "POST",
        body: JSON.stringify({
          namespace: ["memories", assistantId],
          key: "reflection",
        }),
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (!getRes.ok) {
        throw new Error("Failed to get existing reflections");
      }

      // First get existing reflections
      const getCustomReflectionsRes = await fetch("/api/store/get", {
        method: "POST",
        body: JSON.stringify({
          namespace: ["memories", assistantId],
          key: "custom-reflection",
        }),
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (!getCustomReflectionsRes.ok) {
        throw new Error("Failed to get existing reflections");
      }

      const { item } = await getRes.json();
      const existingReflections = item?.value || { styleRules: [], content: [] };

      const { item: customReflectionsItem } = await getCustomReflectionsRes.json();
      const existingCustomReflections = customReflectionsItem?.value || { styleRules: [], content: [] };

      // Merge new reflections with existing ones
      const mergedReflections = {
        styleRules: Array.from(new Set([...existingReflections.styleRules, ...newStyleRules])),
        content: Array.from(new Set([...existingReflections.content, ...newContent])),
      };

      const mergedCustomReflections = {
        styleRules: Array.from(new Set([...existingCustomReflections.styleRules, ...newStyleRules])),
        content: Array.from(new Set([...existingCustomReflections.content, ...newContent])),
      };

      // Save merged reflections
      const putRes = await fetch("/api/store/put", {
        method: "POST",
        body: JSON.stringify({
          namespace: ["memories", assistantId],
          key: "reflection",
          value: mergedReflections,
        }),
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (!putRes.ok) {
        throw new Error("Failed to save reflections");
      }

      const customReflectionPutRes = await fetch("/api/store/put", {
        method: "POST",
        body: JSON.stringify({
          namespace: ["memories", assistantId],
          key: "custom-reflection",
          value: mergedCustomReflections,
        }),
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (!customReflectionPutRes.ok) {
        throw new Error("Failed to save custom reflections");
      }

      // Update local state
      setReflections({
        ...mergedReflections,
        assistantId,
        updatedAt: new Date(),
      });
    } catch (error) {
      console.error("Failed to add reflections:", error);
      throw error;
    } finally {
      setIsLoadingReflections(false);
    }
  };

  const deleteReflections = async (assistantId: string): Promise<boolean> => {
    const res = await fetch("/api/store/delete", {
      method: "POST",
      body: JSON.stringify({
        namespace: ["memories", assistantId],
        key: "reflection",
      }),
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (!res.ok) {
      return false;
    }

    const deleteCustomReflectionsRes = await fetch("/api/store/delete", {
      method: "POST",
      body: JSON.stringify({
        namespace: ["memories", assistantId],
        key: "custom-reflection",
      }),
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (!deleteCustomReflectionsRes.ok) {
      return false;
    }

    const { success } = await res.json();
    if (success) {
      setReflections(undefined);
    } else {
      toast({
        title: "Failed to delete reflections",
        description: "Please try again later.",
      });
    }
    return success;
  };

  const getCustomQuickActions = async (
    userId: string
  ): Promise<CustomQuickAction[] | undefined> => {
    setIsLoadingQuickActions(true);
    try {
      const res = await fetch("/api/store/get", {
        method: "POST",
        body: JSON.stringify({
          namespace: ["custom_actions", userId],
          key: "actions",
        }),
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (!res.ok) {
        return undefined;
      }

      const { item } = await res.json();
      if (!item?.value) {
        return undefined;
      }
      return Object.values(item?.value);
    } finally {
      setIsLoadingQuickActions(false);
    }
  };

  const deleteCustomQuickAction = async (
    id: string,
    rest: CustomQuickAction[],
    userId: string
  ): Promise<boolean> => {
    const valuesWithoutDeleted = rest.reduce<Record<string, CustomQuickAction>>(
      (acc, action) => {
        if (action.id !== id) {
          acc[action.id] = action;
        }
        return acc;
      },
      {}
    );

    const res = await fetch("/api/store/put", {
      method: "POST",
      body: JSON.stringify({
        namespace: ["custom_actions", userId],
        key: "actions",
        value: valuesWithoutDeleted,
      }),
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (!res.ok) {
      return false;
    }

    const { success } = await res.json();
    return success;
  };

  const createCustomQuickAction = async (
    newAction: CustomQuickAction,
    rest: CustomQuickAction[],
    userId: string
  ): Promise<boolean> => {
    const newValue = rest.reduce<Record<string, CustomQuickAction>>(
      (acc, action) => {
        acc[action.id] = action;
        return acc;
      },
      {}
    );

    newValue[newAction.id] = newAction;
    const res = await fetch("/api/store/put", {
      method: "POST",
      body: JSON.stringify({
        namespace: ["custom_actions", userId],
        key: "actions",
        value: newValue,
      }),
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (!res.ok) {
      return false;
    }

    const { success } = await res.json();
    return success;
  };

  const editCustomQuickAction = async (
    editedAction: CustomQuickAction,
    rest: CustomQuickAction[],
    userId: string
  ): Promise<boolean> => {
    const newValue = rest.reduce<Record<string, CustomQuickAction>>(
      (acc, action) => {
        acc[action.id] = action;
        return acc;
      },
      {}
    );

    newValue[editedAction.id] = editedAction;
    const res = await fetch("/api/store/put", {
      method: "POST",
      body: JSON.stringify({
        namespace: ["custom_actions", userId],
        key: "actions",
        value: newValue,
      }),
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (!res.ok) {
      return false;
    }

    const { success } = await res.json();
    return success;
  };

  const putContextDocuments = async ({
    assistantId,
    documents,
  }: {
    assistantId: string;
    documents: ContextDocument[];
  }): Promise<void> => {
    try {
      const res = await fetch("/api/store/put", {
        method: "POST",
        body: JSON.stringify({
          namespace: CONTEXT_DOCUMENTS_NAMESPACE,
          key: assistantId,
          value: {
            documents,
          },
        }),
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (!res.ok) {
        throw new Error(
          "Failed to put context documents" + res.statusText + res.status
        );
      }
    } catch (e) {
      console.error("Failed to put context documents.\n", e);
    }
  };

  const getContextDocuments = async (
    assistantId: string
  ): Promise<ContextDocument[] | undefined> => {
    const res = await fetch("/api/store/get", {
      method: "POST",
      body: JSON.stringify({
        namespace: CONTEXT_DOCUMENTS_NAMESPACE,
        key: assistantId,
      }),
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (!res.ok) {
      console.error(
        "Failed to get context documents",
        res.statusText,
        res.status
      );
      return undefined;
    }

    const { item }: { item: Item | null } = await res.json();
    if (!item?.value?.documents) {
      return undefined;
    }

    return item?.value?.documents;
  };

  return {
    isLoadingReflections,
    reflections,
    isLoadingQuickActions,
    deleteReflections,
    getReflections,
    addReflections,
    deleteCustomQuickAction,
    getCustomQuickActions,
    editCustomQuickAction,
    createCustomQuickAction,
    putContextDocuments,
    getContextDocuments,
  };
}
