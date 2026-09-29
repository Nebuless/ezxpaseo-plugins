import type { RpcInput } from "@getpaseo/plugin";
import {
  DEMO_RESOURCES,
  searchDemoResources,
} from "../shared/resources";

export function searchResources({ query }: RpcInput<typeof searchDemoResources>) {
  const needle = query.trim().toLocaleLowerCase();
  const items = DEMO_RESOURCES.filter((resource) => {
    if (!needle) return true;
    return [resource.identifier, resource.title, resource.subtitle, resource.text]
      .join("\n")
      .toLocaleLowerCase()
      .includes(needle);
  });
  return { items };
}
