import React from "react";
import { Tag } from "primereact/tag";

interface DisplayText {
  active: string;
  inactive: string;
}
interface Server {
  name: string;
  status: boolean;
}

export default function StatusTag(values: Server, displayText:DisplayText) {
  return (
      <Tag
          className={'w-9rem h-2rem text-base font-normal select-none'}
          value={values.status ? displayText.active : displayText.inactive}
          severity={values.status ? 'success' : 'danger'}
      >
      </Tag>
  );
};