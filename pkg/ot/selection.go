package ot

type Selection struct {
	Anchor int
	Head   int
}

func TransformSelection(selection Selection, operation *Operation) Selection {
	transformIndex := func(index int) int {
		newIndex := index
		for _, op := range operation.Ops {
			switch v := op.(type) {
			case RetainOp:
				index -= v.N
			case InsertOp:
				newIndex += len(v.Text)
			case DeleteOp:
				newIndex -= min(index, v.N)
				index -= v.N
			}
			if index < 0 {
				break
			}
		}
		return newIndex
	}

	newAnchor := transformIndex(selection.Anchor)
	if selection.Anchor == selection.Head {
		return Selection{Anchor: newAnchor, Head: newAnchor}
	}
	return Selection{Anchor: newAnchor, Head: transformIndex(selection.Head)}
}
