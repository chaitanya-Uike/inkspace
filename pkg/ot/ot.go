package ot

import "fmt"

type Op interface{ opKind() }

type RetainOp struct{ N int }
type InsertOp struct{ Text string }
type DeleteOp struct{ N int }

func (RetainOp) opKind() {}
func (InsertOp) opKind() {}
func (DeleteOp) opKind() {}

type Operation struct {
	Ops          []Op
	BaseLength   int
	TargetLength int
	ClientID     int
}

func NewOperation() *Operation {
	return &Operation{}
}

func (o *Operation) Retain(n int) *Operation {
	if n == 0 {
		return o
	}
	o.BaseLength += n
	o.TargetLength += n
	if len(o.Ops) > 0 {
		if last, ok := o.Ops[len(o.Ops)-1].(RetainOp); ok {
			o.Ops[len(o.Ops)-1] = RetainOp{N: last.N + n}
			return o
		}
	}
	o.Ops = append(o.Ops, RetainOp{N: n})
	return o
}

func (o *Operation) Insert(text string) *Operation {
	if text == "" {
		return o
	}
	o.TargetLength += len(text)
	last := len(o.Ops) - 1
	if last >= 0 {
		if ins, ok := o.Ops[last].(InsertOp); ok {
			o.Ops[last] = InsertOp{Text: ins.Text + text}
			return o
		}
		if _, ok := o.Ops[last].(DeleteOp); ok {
			if last-1 >= 0 {
				if ins, ok := o.Ops[last-1].(InsertOp); ok {
					o.Ops[last-1] = InsertOp{Text: ins.Text + text}
					return o
				}
			}
			// insert before the delete
			o.Ops = append(o.Ops, nil)
			o.Ops[last+1] = o.Ops[last]
			o.Ops[last] = InsertOp{Text: text}
			return o
		}
	}
	o.Ops = append(o.Ops, InsertOp{Text: text})
	return o
}

func (o *Operation) Delete(n int) *Operation {
	if n == 0 {
		return o
	}
	o.BaseLength += n
	if len(o.Ops) > 0 {
		if last, ok := o.Ops[len(o.Ops)-1].(DeleteOp); ok {
			o.Ops[len(o.Ops)-1] = DeleteOp{N: last.N + n}
			return o
		}
	}
	o.Ops = append(o.Ops, DeleteOp{N: n})
	return o
}

func (o *Operation) Apply(str string) (string, error) {
	if len(str) != o.BaseLength {
		return "", fmt.Errorf("the operation's base length must be equal to the string's length")
	}
	result := make([]byte, 0, o.TargetLength)
	strIndex := 0
	for _, op := range o.Ops {
		switch v := op.(type) {
		case RetainOp:
			if strIndex+v.N > len(str) {
				return "", fmt.Errorf("operation can't retain more characters than are left in the string")
			}
			result = append(result, str[strIndex:strIndex+v.N]...)
			strIndex += v.N
		case InsertOp:
			result = append(result, v.Text...)
		case DeleteOp:
			strIndex += v.N
		}
	}
	if strIndex != len(str) {
		return "", fmt.Errorf("the operation didn't operate on the whole string")
	}
	return string(result), nil
}

func Transform(op1, op2 *Operation) (*Operation, *Operation, error) {
	if op1.BaseLength != op2.BaseLength {
		return nil, nil, fmt.Errorf("both operations have to have the same base length")
	}

	op1Prime := &Operation{ClientID: op1.ClientID}
	op2Prime := &Operation{ClientID: op2.ClientID}

	ops1 := op1.Ops
	ops2 := op2.Ops
	i1, i2 := 0, 0

	var o1, o2 Op
	nextO1 := func() {
		if i1 < len(ops1) {
			o1 = ops1[i1]
			i1++
		} else {
			o1 = nil
		}
	}
	nextO2 := func() {
		if i2 < len(ops2) {
			o2 = ops2[i2]
			i2++
		} else {
			o2 = nil
		}
	}

	nextO1()
	nextO2()

	for {
		if o1 == nil && o2 == nil {
			break
		}

		_, o1IsInsert := o1.(InsertOp)
		_, o2IsInsert := o2.(InsertOp)

		if o1IsInsert && (!o2IsInsert || op1.ClientID > op2.ClientID) {
			op1Prime.Insert(o1.(InsertOp).Text)
			op2Prime.Retain(len(o1.(InsertOp).Text))
			nextO1()
			continue
		}
		if o2IsInsert {
			op1Prime.Retain(len(o2.(InsertOp).Text))
			op2Prime.Insert(o2.(InsertOp).Text)
			nextO2()
			continue
		}

		if o1 == nil {
			return nil, nil, fmt.Errorf("cannot compose operations: first operation is too short")
		}
		if o2 == nil {
			return nil, nil, fmt.Errorf("cannot compose operations: first operation is too long")
		}

		switch v1 := o1.(type) {
		case RetainOp:
			switch v2 := o2.(type) {
			case RetainOp:
				minL := min(v1.N, v2.N)
				v1.N -= minL
				v2.N -= minL
				if v1.N == 0 {
					nextO1()
				} else {
					o1 = v1
				}
				if v2.N == 0 {
					nextO2()
				} else {
					o2 = v2
				}
				op1Prime.Retain(minL)
				op2Prime.Retain(minL)
			case DeleteOp:
				minL := min(v1.N, v2.N)
				v1.N -= minL
				v2.N -= minL
				if v1.N == 0 {
					nextO1()
				} else {
					o1 = v1
				}
				if v2.N == 0 {
					nextO2()
				} else {
					o2 = v2
				}
				op2Prime.Delete(minL)
			}
		case DeleteOp:
			switch v2 := o2.(type) {
			case DeleteOp:
				minL := min(v1.N, v2.N)
				v1.N -= minL
				v2.N -= minL
				if v1.N == 0 {
					nextO1()
				} else {
					o1 = v1
				}
				if v2.N == 0 {
					nextO2()
				} else {
					o2 = v2
				}
			case RetainOp:
				minL := min(v1.N, v2.N)
				v1.N -= minL
				v2.N -= minL
				if v1.N == 0 {
					nextO1()
				} else {
					o1 = v1
				}
				if v2.N == 0 {
					nextO2()
				} else {
					o2 = v2
				}
				op1Prime.Delete(minL)
			}
		default:
			return nil, nil, fmt.Errorf("the two operations aren't compatible")
		}
	}

	return op1Prime, op2Prime, nil
}

// wire format: positive int = retain, negative int = delete, string = insert

type OperationData struct {
	ClientID     int   `json:"cid"`
	Ops          []any `json:"ops"`
	BaseLength   int   `json:"base"`
	TargetLength int   `json:"target"`
}

func SerializeOperation(op *Operation) OperationData {
	ops := make([]any, len(op.Ops))
	for i, o := range op.Ops {
		switch v := o.(type) {
		case RetainOp:
			ops[i] = v.N
		case InsertOp:
			ops[i] = v.Text
		case DeleteOp:
			ops[i] = -v.N
		}
	}
	return OperationData{
		ClientID:     op.ClientID,
		Ops:          ops,
		BaseLength:   op.BaseLength,
		TargetLength: op.TargetLength,
	}
}

func DeserializeOperation(data OperationData) (*Operation, error) {
	op := &Operation{
		ClientID:     data.ClientID,
		BaseLength:   data.BaseLength,
		TargetLength: data.TargetLength,
	}
	for _, raw := range data.Ops {
		switch v := raw.(type) {
		case float64:
			if v > 0 {
				op.Ops = append(op.Ops, RetainOp{N: int(v)})
			} else if v < 0 {
				op.Ops = append(op.Ops, DeleteOp{N: int(-v)})
			}
		case string:
			op.Ops = append(op.Ops, InsertOp{Text: v})
		default:
			return nil, fmt.Errorf("unexpected op type in deserialization: %T", raw)
		}
	}
	return op, nil
}
