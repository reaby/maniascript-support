export interface completionsType {
  primitives: string[];
  namespaces: any;
  classes: any;
}

export const completionsTemplate: completionsType = {
  primitives: [],
  namespaces: {},
  classes: {
    Int2: {
      inherit: "",
      enums: {},
      methods: [],
      props: {
        Integer: ["X", "Y"],
      },
    },
    Vec2: {
      inherit: "",
      enums: {},
      methods: [],
      props: {
        Real: ["X", "Y"],
      },
    },
    Vec3: {
      inherit: "",
      enums: {},
      methods: [],
      props: {
        Real: ["X", "Y", "Z"],
      },
    },
    Int3: {
      inherit: "",
      enums: {},
      methods: [],
      props: {
        Integer: ["X", "Y", "Z"],
      },
    },
  },
};
