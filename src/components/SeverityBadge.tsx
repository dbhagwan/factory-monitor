import { Badge } from "@chakra-ui/react";
import { SEVERITY_LABEL, toneHex, type Severity } from "../lib/health";

export function SeverityBadge({ severity, hollow }: { severity: Severity; hollow?: boolean }) {
  const hex = toneHex(severity);
  return (
    <Badge
      px={2}
      py={0.5}
      fontSize="xs"
      bg={hollow ? "transparent" : `${hex}22`}
      color={hex}
      border="1px solid"
      borderColor={hollow ? hex : "transparent"}
    >
      {SEVERITY_LABEL[severity]}
    </Badge>
  );
}
