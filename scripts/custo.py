# Preços USD por 1M tokens (Gemini API, Standard). "fut" = após o fim do preço promocional.
P = {
 'argon':   dict(inp=2.00, out=10.0, cache=0.10, fut_inp=4.00, fut_out=20.0, fut_cache=0.20),   # a partir de 1/12/2026
 'flash38': dict(inp=0.75, out=3.75, cache=0.075, fut_inp=1.50, fut_out=7.50, fut_cache=0.15), # a partir de 1/1/2027
 'lite31':  dict(inp=0.25, out=1.50, cache=0.025, fut_inp=0.25, fut_out=1.50, fut_cache=0.025),
}
TRANS_MIN = 0.003 + 0.002  # gemini-3.5-transcribe, US$/min (entrada de áudio + saída de texto)
# tarefa, modelo, k_in, k_cache, k_out, usos/mês, batch
T = [
 ('Tutor: conversa durante a leitura','flash38',3,12,1.0,220,False),
 ('Tutor: perguntas antes de ler','flash38',13,0,0.6,15,False),
 ('Tutor: comentários no fichamento','flash38',18,0,1.5,15,False),
 ('Diálogos','flash38',8,0,1.0,60,False),
 ('Copilot: entrevista e briefing','flash38',8,0,0.8,60,False),
 ('Copilot: versões do parágrafo','argon',12,0,3.5,40,False),
 ('Copilot: diagnóstico e estrutura','argon',25,0,6.0,3,False),
 ('Revisar e exportar','argon',25,0,5.0,3,False),
 ('Revisão do projeto','argon',55,0,18.0,2,True),
 ('Resumo e citações da aula','flash38',25,0,2.0,12,False),
 ('Orientação: resumo e combinados','flash38',12,0,1.5,2,False),
 ('Plano de ensino','flash38',10,0,2.0,1,False),
 ('Overview do autor','flash38',30,0,3.0,4,True),
 ('Cartões de revisão','lite31',3,0,0.8,30,True),
 ('Metadados do PDF','lite31',2,0,0.3,15,False),
 ('Memória: o que lembrar','lite31',8,0,0.5,30,False),
]
def custo(m,kin,kc,kout,fut,batch):
    p=P[m]; f='fut_' if fut else ''
    c=(kin*p[f+'inp']+kc*p[f+'cache']+kout*p[f+'out'])/1000
    return c*(0.5 if batch else 1)
tot_a=tot_f=0; rows=[]
for nome,m,kin,kc,kout,n,b in T:
    a=custo(m,kin,kc,kout,False,b); f=custo(m,kin,kc,kout,True,b)
    rows.append((nome,m,a,f,n,a*n,f*n)); tot_a+=a*n; tot_f+=f*n
aulas=12*100*TRANS_MIN; orient=2*45*TRANS_MIN; emb=0.47*0.10
for nome,v in [('Transcrição de aulas (12 × 100 min)',aulas),('Transcrição da orientação (2 × 45 min)',orient),('Busca e conexões (embeddings)',emb)]:
    rows.append((nome,'-',0,0,0,v,v)); tot_a+=v; tot_f+=v
for r in rows: print(f"{r[0]:42s} {r[1]:8s} uso:{r[2]:.4f}/{r[3]:.4f}  mês:{r[5]:.2f}/{r[6]:.2f}")
print(f"TOTAL mês: agora {tot_a:.2f}  depois {tot_f:.2f}")
# alternativa econômica de transcrição com 3.1 Flash-Lite: 32 tok/s audio a $0.50/M + saída ~15k tokens
lite_aula=(100*60*32*0.50 + 15000*1.50)/1e6
print(f"Aula 100 min: transcribe {100*TRANS_MIN:.2f}  flash-lite {lite_aula:.3f}")
# tokens/mês
tk=sum((kin+kc+kout)*n for _,_,kin,kc,kout,n,_ in T)
print("mil tokens texto/mês:",tk)
