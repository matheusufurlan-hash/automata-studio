/*
 * Oráculo de testes do núcleo de Autômatos com Pilha (AP) do Autômatos Studio.
 *
 * Roda o YAAS ORIGINAL (Prof. Dr. David Buzatto, GPL v3) em cada exemplo de
 * AP e grava os resultados em src/core/pda/__fixtures__/oraculo.json. Os
 * testes em TypeScript (src/core/pda/oraculo.test.ts e examples.test.ts)
 * comparam a nossa implementação com esse arquivo.
 *
 * Como rodar (de dentro de tools/oraculo):
 *
 *   javac -cp ~/Downloads/YAAS-1.0.7.jar -d /tmp/oraculo-ap GerarOraculoAP.java
 *   java -Djava.awt.headless=true -cp ~/Downloads/YAAS-1.0.7.jar:/tmp/oraculo-ap \
 *        GerarOraculoAP ../../src/core/pda/__fixtures__/oraculo.json
 *
 * O AP do YAAS NÃO segue o Hopcroft: cada operação é DO_NOTHING, POP, PUSH
 * ou REPLACE, e existe um "topo ε" que só casa com a pilha vazia. A
 * estrutura gravada traz cada operação traduzida para a regra "a, X/γ" do
 * Hopcroft (o 1º símbolo de γ fica no topo), conferindo com
 * PDA.processStack:
 *   - DO_NOTHING(X)       → γ = X
 *   - POP(X)              → γ = ε
 *   - REPLACE(X, s1..sn)  → γ = sn..s1   (o YAAS empilha s1 primeiro)
 *   - PUSH(X, s1..sn)     → γ = sn..s1 X (empilha sem tirar o X)
 *   - topo ε: sem tradução (gravado com "push": null e "topoEpsilon": true).
 *
 * O que é gravado para cada exemplo:
 *   - acceptance: o modo de aceitação usado pelo YAAS para o exemplo (o
 *     mesmo do menu do YAAS; o AP do YAAS não guarda o modo);
 *   - type: DPDA / PDA segundo o YAAS;
 *   - alphabet, stackAlphabet, startStackSymbol;
 *   - structure: estados (nome, posição, inicial, final) e transições (com
 *     as regras traduzidas e a forma da seta), para conferir que
 *     src/core/pda/examples.ts é uma cópia fiel do exemplo;
 *   - accepted: palavras aceitas de tamanho 0 até maxLength sobre Σ;
 *   - conversion: o AP gerado pela conversão do YAAS para o OUTRO modo
 *     (PDAFinalStateToEmptyStack ou PDAEmptyStackToFinalState): nº de
 *     estados, de transições e de regras, o novo fundo de pilha e as
 *     palavras aceitas no modo novo.
 *
 * Linguagens: para cada tamanho, a quantidade de palavras aceitas e o
 * SHA-256 da lista ordenada (ordem de String.compareTo) juntada com "\n";
 * a lista explícita vai em "words" quando é pequena.
 */

import br.com.davidbuzatto.yaas.model.pda.PDA;
import br.com.davidbuzatto.yaas.model.pda.PDAAcceptanceType;
import br.com.davidbuzatto.yaas.model.pda.PDAOperation;
import br.com.davidbuzatto.yaas.model.pda.PDAState;
import br.com.davidbuzatto.yaas.model.pda.PDATransition;
import br.com.davidbuzatto.yaas.model.pda.algorithms.PDAEmptyStackToFinalState;
import br.com.davidbuzatto.yaas.model.pda.algorithms.PDAFinalStateToEmptyStack;
import br.com.davidbuzatto.yaas.model.pda.examples.PDAExamples;
import br.com.davidbuzatto.yaas.util.CharacterConstants;
import java.lang.reflect.Field;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.security.MessageDigest;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HexFormat;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.function.Supplier;

public class GerarOraculoAP {

    static final int MAX_LENGTH = 6;
    static final long MAX_UNIVERSE = 50_000;
    static final int MAX_EXPLICIT_WORDS = 1_000;

    static final PDAAcceptanceType FS = PDAAcceptanceType.FINAL_STATE;
    static final PDAAcceptanceType ES = PDAAcceptanceType.EMPTY_STACK;

    record Example( String id, String source, Supplier<PDA> factory, PDAAcceptanceType acceptance ) {}

    /** Os ids precisam ser os mesmos de src/core/pda/examples.ts. */
    static final List<Example> EXAMPLES = List.of(
        new Example( "ap-palindromo-par", "PDAExamples.createPDAEvenPalindromeFinalState", PDAExamples::createPDAEvenPalindromeFinalState, FS ),
        new Example( "ap-comeca-com-0", "PDAExamples.createPDA01FinalState", PDAExamples::createPDA01FinalState, FS ),
        new Example( "ap-0n1n", "PDAExamples.createPDA0n1nFinalState", PDAExamples::createPDA0n1nFinalState, FS ),
        new Example( "ap-mesmo-numero-de-0-e-1", "PDAExamples.createPDA01SameFinalState", PDAExamples::createPDA01SameFinalState, FS ),
        new Example( "ap-aibjck", "PDAExamples.createPDAAiBjCkFinalState", PDAExamples::createPDAAiBjCkFinalState, FS ),
        new Example( "ap-0-vale-dois", "PDAExamples.createPDATest0Double1FinalState", PDAExamples::createPDATest0Double1FinalState, FS ),
        new Example( "ap-palindromo-par-pilha-vazia", "PDAExamples.createPDAEvenPalindromeEmptyStack", PDAExamples::createPDAEvenPalindromeEmptyStack, ES ),
        new Example( "ap-0n1n-pilha-vazia", "PDAExamples.createPDA0n1nEmptyStack", PDAExamples::createPDA0n1nEmptyStack, ES ),
        new Example( "ap-mesmo-numero-de-0-e-1-pilha-vazia", "PDAExamples.createPDA01SameEmptyStack", PDAExamples::createPDA01SameEmptyStack, ES ),
        new Example( "apd-palindromo-com-marca", "PDAExamples.createDPDAEvenPalindromeCenterMark", PDAExamples::createDPDAEvenPalindromeCenterMark, FS ),
        new Example( "apd-0n1n", "PDAExamples.createDPDA0n1n", PDAExamples::createDPDA0n1n, FS ),
        new Example( "apd-diferenca-de-0-e-1", "PDAExamples.createDPDA01Same", PDAExamples::createDPDA01Same, FS ),
        new Example( "ap-transicao-vazia-com-pilha-vazia", "PDAExamples.createPDAEmptyTransitionEmptyStackFinalState", PDAExamples::createPDAEmptyTransitionEmptyStackFinalState, FS ),
        new Example( "ap-ciclo-de-transicoes-vazias", "PDAExamples.createPDAEmptyTransitionCycleFinalState", PDAExamples::createPDAEmptyTransitionCycleFinalState, FS )
    );

    public static void main( String[] args ) throws Exception {

        Path out = Path.of( args.length > 0 ? args[0] : "oraculo.json" );

        Map<String, Object> root = new LinkedHashMap<>();
        root.put( "generator", "tools/oraculo/GerarOraculoAP.java" );
        root.put( "yaas", "YAAS-1.0.7.jar" );
        root.put( "hash", "sha256 das palavras aceitas de cada tamanho, ordenadas e juntadas com \\n" );

        List<Object> examples = new ArrayList<>();
        for ( Example e : EXAMPLES ) {
            examples.add( processExample( e ) );
            System.out.println( "ok: " + e.id() );
        }
        root.put( "examples", examples );

        StringBuilder sb = new StringBuilder();
        writeJson( root, sb, 0 );
        sb.append( '\n' );
        Files.createDirectories( out.toAbsolutePath().getParent() );
        Files.writeString( out, sb.toString(), StandardCharsets.UTF_8 );
        System.out.println( "gravado: " + out.toAbsolutePath() );

    }

    static Map<String, Object> processExample( Example e ) throws Exception {

        PDA pda = e.factory().get();
        pda.updateType();
        List<Character> sigma = new ArrayList<>( pda.getAlphabet() );
        int maxLength = maxLength( sigma.size() );

        Map<String, Object> r = new LinkedHashMap<>();
        r.put( "id", e.id() );
        r.put( "source", e.source() );
        r.put( "acceptance", e.acceptance().name() );
        r.put( "type", pda.getType().name() );
        r.put( "alphabet", charsToStrings( sigma ) );
        r.put( "stackAlphabet", charsToStrings( pda.getStackAlphabet() ) );
        r.put( "startStackSymbol", String.valueOf( pda.getStackStartingSymbol() ) );
        r.put( "maxLength", maxLength );
        r.put( "structure", structure( pda ) );
        r.put( "accepted", language( pda, sigma, maxLength, e.acceptance() ) );

        // conversão do YAAS para o outro modo (sobre um AP novo, para não
        // depender de nada que as simulações acima tenham deixado no objeto)
        PDA source = e.factory().get();
        PDA conv;
        PDAAcceptanceType mode;
        String algorithm;
        if ( e.acceptance() == FS ) {
            conv = new PDAFinalStateToEmptyStack( source ).getGeneratedPDA();
            mode = ES;
            algorithm = "PDAFinalStateToEmptyStack";
        } else {
            conv = new PDAEmptyStackToFinalState( source ).getGeneratedPDA();
            mode = FS;
            algorithm = "PDAEmptyStackToFinalState";
        }
        int rules = 0;
        for ( PDATransition t : conv.getTransitions() ) {
            rules += t.getOperations().size();
        }
        Map<String, Object> c = new LinkedHashMap<>();
        c.put( "algorithm", algorithm );
        c.put( "acceptance", mode.name() );
        c.put( "states", conv.getStates().size() );
        c.put( "transitions", conv.getTransitions().size() );
        c.put( "rules", rules );
        c.put( "startStackSymbol", String.valueOf( conv.getStackStartingSymbol() ) );
        c.put( "accepted", language( conv, sigma, maxLength, mode ) );
        r.put( "conversion", c );

        return r;

    }

    /* ------------------------------------------------------------------ */

    static int maxLength( int k ) {
        int len = 0;
        long total = 1;
        long power = 1;
        while ( len < MAX_LENGTH ) {
            power *= Math.max( k, 1 );
            if ( k == 0 || total + power > MAX_UNIVERSE ) {
                break;
            }
            total += power;
            len++;
        }
        return len;
    }

    static Map<String, Object> language( PDA pda, List<Character> sigma, int maxLength,
            PDAAcceptanceType acceptance ) throws Exception {

        List<Integer> counts = new ArrayList<>();
        List<String> hashes = new ArrayList<>();
        List<String> all = new ArrayList<>();

        List<String> current = new ArrayList<>();
        current.add( "" );
        for ( int len = 0; len <= maxLength; len++ ) {
            if ( len > 0 ) {
                List<String> next = new ArrayList<>();
                for ( String w : current ) {
                    for ( char c : sigma ) {
                        next.add( w + c );
                    }
                }
                current = next;
            }
            List<String> accepted = new ArrayList<>();
            for ( String w : current ) {
                if ( pda.accepts( w, acceptance ) ) {
                    accepted.add( w );
                }
            }
            Collections.sort( accepted );
            counts.add( accepted.size() );
            hashes.add( sha256( String.join( "\n", accepted ) ) );
            all.addAll( accepted );
        }

        Map<String, Object> r = new LinkedHashMap<>();
        r.put( "counts", counts );
        r.put( "sha256", hashes );
        if ( all.size() <= MAX_EXPLICIT_WORDS ) {
            r.put( "words", all );
        }
        return r;

    }

    /** γ do Hopcroft para uma operação do YAAS (null para o "topo ε"). */
    static String hopcroftPush( PDAOperation o ) {
        if ( o.getTop() == CharacterConstants.EMPTY_STRING ) {
            return null;
        }
        StringBuilder reversed = new StringBuilder();
        List<Character> symbols = o.getSymbolsToPush();
        for ( int i = symbols.size() - 1; i >= 0; i-- ) {
            reversed.append( symbols.get( i ) );
        }
        return switch ( o.getType() ) {
            case DO_NOTHING -> String.valueOf( o.getTop() );
            case POP -> "";
            case PUSH -> reversed.toString() + o.getTop();
            case REPLACE -> reversed.toString();
        };
    }

    static Map<String, Object> structure( PDA pda ) throws Exception {

        List<PDAState> states = pda.getStates();
        List<Object> ss = new ArrayList<>();
        for ( PDAState s : states ) {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put( "name", s.toString() );
            m.put( "x", s.getX1() );
            m.put( "y", s.getY1() );
            m.put( "initial", s.isInitial() );
            m.put( "final", s.isFinal() );
            ss.add( m );
        }

        Field centralField = PDATransition.class.getDeclaredField( "centralCP" );
        centralField.setAccessible( true );
        Field angleField = PDATransition.class.getDeclaredField( "targetCPAngle" );
        angleField.setAccessible( true );

        List<Object> ts = new ArrayList<>();
        for ( PDATransition t : pda.getTransitions() ) {
            Map<String, Object> m = new LinkedHashMap<>();
            PDAState from = t.getOriginState();
            PDAState to = t.getTargetState();
            m.put( "from", states.indexOf( from ) );
            m.put( "to", states.indexOf( to ) );
            List<Object> rules = new ArrayList<>();
            for ( PDAOperation o : t.getOperations() ) {
                Map<String, Object> rm = new LinkedHashMap<>();
                rm.put( "read", String.valueOf( o.getSymbol() ) );
                rm.put( "pop", String.valueOf( o.getTop() ) );
                String push = hopcroftPush( o );
                rm.put( "push", push );
                if ( push == null ) {
                    rm.put( "topoEpsilon", true );
                }
                rm.put( "yaas", o.getType().name() + " " + o );
                rules.add( rm );
            }
            m.put( "rules", rules );
            if ( from == to ) {
                // laço: ângulo em graus (0 = em cima, positivo = sentido horário na tela)
                double angle = (double) angleField.get( t );
                m.put( "loopAngle", (int) Math.round( Math.toDegrees( angle ) ) );
            } else {
                // curva: deslocamento do ponto do meio da curva em relação ao meio
                // da reta entre os centros, dividido pelo comprimento da reta.
                // positivo = curva para a esquerda de quem anda de "from" para "to"
                Object cp = centralField.get( t );
                int cx = (int) cp.getClass().getMethod( "getX1" ).invoke( cp );
                int cy = (int) cp.getClass().getMethod( "getY1" ).invoke( cp );
                double dx = to.getX1() - from.getX1();
                double dy = to.getY1() - from.getY1();
                double len = Math.hypot( dx, dy );
                double mx = cx - ( from.getX1() + to.getX1() ) / 2.0;
                double my = cy - ( from.getY1() + to.getY1() ) / 2.0;
                double cross = ( dx * my - dy * mx ) / len;
                double curvature = len == 0 ? 0 : -cross / len;
                m.put( "curvature", Math.round( curvature * 100 ) / 100.0 );
            }
            ts.add( m );
        }

        Map<String, Object> r = new LinkedHashMap<>();
        r.put( "states", ss );
        r.put( "transitions", ts );
        return r;

    }

    static List<String> charsToStrings( Iterable<Character> cs ) {
        List<String> r = new ArrayList<>();
        for ( Character c : cs ) {
            r.add( String.valueOf( c ) );
        }
        return r;
    }

    static String sha256( String s ) throws Exception {
        MessageDigest md = MessageDigest.getInstance( "SHA-256" );
        return HexFormat.of().formatHex( md.digest( s.getBytes( StandardCharsets.UTF_8 ) ) );
    }

    /* ------------------------------------------------------------------ */
    /* JSON (sem biblioteca): listas de valores simples ficam numa linha    */
    /* ------------------------------------------------------------------ */

    static void writeJson( Object v, StringBuilder sb, int indent ) {
        if ( v == null ) {
            sb.append( "null" );
        } else if ( v instanceof Map<?, ?> map ) {
            if ( map.isEmpty() ) {
                sb.append( "{}" );
                return;
            }
            sb.append( "{\n" );
            boolean first = true;
            for ( Map.Entry<?, ?> e : map.entrySet() ) {
                if ( !first ) {
                    sb.append( ",\n" );
                }
                first = false;
                pad( sb, indent + 1 );
                writeString( String.valueOf( e.getKey() ), sb );
                sb.append( ": " );
                writeJson( e.getValue(), sb, indent + 1 );
            }
            sb.append( '\n' );
            pad( sb, indent );
            sb.append( '}' );
        } else if ( v instanceof List<?> list ) {
            boolean simple = true;
            for ( Object o : list ) {
                if ( o instanceof Map || o instanceof List ) {
                    simple = false;
                    break;
                }
            }
            if ( simple ) {
                sb.append( '[' );
                for ( int i = 0; i < list.size(); i++ ) {
                    if ( i > 0 ) {
                        sb.append( ", " );
                    }
                    writeJson( list.get( i ), sb, indent );
                }
                sb.append( ']' );
            } else {
                sb.append( "[\n" );
                for ( int i = 0; i < list.size(); i++ ) {
                    if ( i > 0 ) {
                        sb.append( ",\n" );
                    }
                    pad( sb, indent + 1 );
                    writeJson( list.get( i ), sb, indent + 1 );
                }
                sb.append( '\n' );
                pad( sb, indent );
                sb.append( ']' );
            }
        } else if ( v instanceof String s ) {
            writeString( s, sb );
        } else {
            sb.append( v );
        }
    }

    static void pad( StringBuilder sb, int indent ) {
        sb.append( "  ".repeat( indent ) );
    }

    static void writeString( String s, StringBuilder sb ) {
        sb.append( '"' );
        for ( char c : s.toCharArray() ) {
            switch ( c ) {
                case '"' -> sb.append( "\\\"" );
                case '\\' -> sb.append( "\\\\" );
                case '\n' -> sb.append( "\\n" );
                case '\t' -> sb.append( "\\t" );
                default -> {
                    if ( c < 0x20 ) {
                        sb.append( String.format( "\\u%04x", (int) c ) );
                    } else {
                        sb.append( c );
                    }
                }
            }
        }
        sb.append( '"' );
    }

}
